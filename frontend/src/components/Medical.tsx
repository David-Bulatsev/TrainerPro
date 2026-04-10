import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, AlertTriangle, Heart, Activity, FileText, Edit, Trash2, Paperclip } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { safeParseJson } from "../lib/json";
import { formatDate } from "../lib/datetime";
import { routes } from "../lib/routes";
import { useSeo } from "../lib/seo";
import type { ApiAthlete, ApiInjury } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { FileAttachmentsModal } from "./FileAttachmentsModal";

type MedicalRecord = {
  id: number;
  athleteName: string;
  athleteAvatar: string;
  type: "injury" | "condition" | "checkup";
  title: string;
  dateLabel: string;
  status: string;
  severity: string;
  description: string;
  recovery: string;
  nextCheckup: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapRecord(injury: ApiInjury, athlete: ApiAthlete | undefined): MedicalRecord {
  const meta = athlete ? safeParseJson<{ avatar?: string }>(athlete.contact_info, {}) : {};
  const type =
    injury.status === "monitoring"
      ? "condition"
      : injury.status === "completed" || injury.status === "recovered"
      ? "checkup"
      : "injury";

  return {
    id: injury.id,
    athleteName: athlete?.name ?? "Неизвестный спортсмен",
    athleteAvatar: meta?.avatar || getInitials(athlete?.name ?? "??"),
    type,
    title: injury.medical_notes?.split(".")[0] || "Медицинская запись",
    dateLabel: formatDate(injury.date),
    status: injury.status ?? "active",
    severity: injury.severity,
    description: injury.description,
    recovery:
      injury.recovery_time != null ? `${injury.recovery_time} дн.` : injury.medical_notes ?? "Не указано",
    nextCheckup: injury.medical_notes ?? "Нет данных",
  };
}

type InjuryFormData = {
  athlete_id: number;
  description: string;
  date: string;
  severity: string;
  recovery_time: string;
  medical_notes: string;
  status: string;
};

const DEFAULT_FORM: InjuryFormData = {
  athlete_id: 0,
  description: "",
  date: new Date().toISOString().split("T")[0],
  severity: "minor",
  recovery_time: "",
  medical_notes: "",
  status: "active",
};

export function Medical() {
  useSeo({
    title: "Medical records",
    description: "Private injury and medical tracking for athletes.",
    path: routes.medical,
    noindex: true,
  });

  const { user } = useAuth();
  const [queryParams, setQueryParams] = useSearchParams();

  const searchQuery = queryParams.get("search") ?? "";
  const filterType = queryParams.get("type") ?? "all";
  const filterStatus = queryParams.get("status") ?? "all";
  const sort = queryParams.get("sort") ?? "date";
  const order = queryParams.get("order") ?? "desc";
  const page = Math.max(1, Number(queryParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, Number(queryParams.get("page_size") ?? "20") || 20));

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const [athletes, setAthletes] = useState<ApiAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [formData, setFormData] = useState<InjuryFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filesModalInjuryId, setFilesModalInjuryId] = useState<number | null>(null);

  const canWriteInjuries = user?.permissions?.includes("injuries:write") ?? false;
  const canReadFiles = user?.permissions?.includes("files:read") ?? false;

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const [athletesRes, injuriesPaged] = await Promise.all([
          api.getAthletes({ limit: 200 }),
          api.getInjuriesPaged({
            page,
            page_size: pageSize,
            search: searchQuery || undefined,
            type: filterType,
            status: filterStatus,
            sort,
            order,
          }),
        ]);
        if (ignore) return;

        setAthletes(athletesRes);
        const athleteMap = new Map(athletesRes.map((athlete) => [athlete.id, athlete]));
        const mapped = injuriesPaged.items.map((injury) =>
          mapRecord(injury, athleteMap.get(injury.athlete_id))
        );

        setRecords(mapped);
        setTotal(injuriesPaged.total);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Не удалось загрузить медицинские записи");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, searchQuery, filterType, filterStatus, sort, order]);

  const handleOpenModal = (record?: MedicalRecord) => {
    if (!canWriteInjuries) return;
    if (record) {
      setEditingRecord(record);
      // Найти оригинальную травму по athleteName
      const athlete = athletes.find((a) => a.name === record.athleteName);
      // Преобразовать дату из формата "15 дек 2024" в YYYY-MM-DD
      const dateParts = record.dateLabel.split(" ");
      let dateStr = new Date().toISOString().split("T")[0];
      if (dateParts.length === 3) {
        // Попробуем распарсить дату
        try {
          const day = parseInt(dateParts[0], 10);
          const monthNames: Record<string, string> = {
            янв: "01", фев: "02", мар: "03", апр: "04", май: "05", июн: "06",
            июл: "07", авг: "08", сен: "09", окт: "10", ноя: "11", дек: "12",
          };
          const month = monthNames[dateParts[1].toLowerCase()] || "01";
          const year = dateParts[2];
          dateStr = `${year}-${month}-${String(day).padStart(2, "0")}`;
        } catch {
          // Оставить значение по умолчанию
        }
      }
      setFormData({
        athlete_id: athlete?.id || 0,
        description: record.description,
        date: dateStr,
        severity: record.severity,
        recovery_time: record.recovery.includes("дн.") ? record.recovery.replace(" дн.", "").trim() : "",
        medical_notes: record.nextCheckup !== "Нет данных" ? record.nextCheckup : "",
        status: record.status,
      });
    } else {
      setEditingRecord(null);
      setFormData(DEFAULT_FORM);
    }
    setIsModalOpen(true);
    setSaveError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormData(DEFAULT_FORM);
    setSaveError(null);
  };


  const handleSave = async () => {
    if (!formData.athlete_id || !formData.description || !formData.date) {
      setSaveError("Заполните все обязательные поля");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (!canWriteInjuries) {
        setSaveError("Недостаточно прав");
        return;
      }
      const payload = {
        athlete_id: formData.athlete_id,
        description: formData.description,
        date: formData.date,
        severity: formData.severity,
        recovery_time: formData.recovery_time ? parseInt(formData.recovery_time, 10) : null,
        medical_notes: formData.medical_notes || null,
        status: formData.status,
      };

      if (editingRecord) {
        await api.updateInjury(editingRecord.id, payload);
      } else {
        await api.createInjury(payload);
      }

      // Перезагрузить данные
      const [athletesRes, injuriesPaged] = await Promise.all([
        api.getAthletes({ limit: 200 }),
        api.getInjuriesPaged({
          page,
          page_size: pageSize,
          search: searchQuery || undefined,
          type: filterType,
          status: filterStatus,
          sort,
          order,
        }),
      ]);
      setAthletes(athletesRes);
      const athleteMap = new Map(athletesRes.map((athlete) => [athlete.id, athlete]));
      const mapped = injuriesPaged.items.map((injury) =>
        mapRecord(injury, athleteMap.get(injury.athlete_id))
      );
      setRecords(mapped);
      setTotal(injuriesPaged.total);

      handleCloseModal();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить запись");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (recordId: number) => {
    if (!canWriteInjuries) {
      setError("Недостаточно прав");
      return;
    }
    if (!confirm("Вы уверены, что хотите удалить эту запись?")) {
      return;
    }

    try {
      await api.deleteInjury(recordId);
      // Перезагрузить данные
      const [athletesRes, injuriesPaged] = await Promise.all([
        api.getAthletes({ limit: 200 }),
        api.getInjuriesPaged({
          page,
          page_size: pageSize,
          search: searchQuery || undefined,
          type: filterType,
          status: filterStatus,
          sort,
          order,
        }),
      ]);
      setAthletes(athletesRes);
      const athleteMap = new Map(athletesRes.map((athlete) => [athlete.id, athlete]));
      const mapped = injuriesPaged.items.map((injury) =>
        mapRecord(injury, athleteMap.get(injury.athlete_id))
      );
      setRecords(mapped);
      setTotal(injuriesPaged.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить запись");
    }
  };

  const filteredRecords = records;

  const updateFilterParam = (key: "search" | "type" | "status", value: string) => {
    setQueryParams((prev) => {
      const next = new URLSearchParams(prev);
      const shouldDelete =
        value === "all" || (key === "search" && value.trim().length === 0);
      if (shouldDelete) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.set("page", "1");
      return next;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'injury': return AlertTriangle;
      case 'condition': return Heart;
      case 'checkup': return Activity;
      default: return FileText;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'injury': return 'Травма';
      case 'condition': return 'Состояние';
      case 'checkup': return 'Осмотр';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'injury': return 'bg-red-50 text-red-600';
      case 'condition': return 'bg-orange-50 text-orange-600';
      case 'checkup': return 'bg-blue-50 text-blue-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-700';
      case 'monitoring': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'recovered': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Активна';
      case 'monitoring': return 'Наблюдение';
      case 'completed': return 'Завершено';
      case 'recovered': return 'Восстановлен';
      default: return status;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-gray-300';
    }
  };

  const stats = useMemo(() => {
    return {
      activeInjuries: records.filter((r) => r.status === "active" && r.type === "injury").length,
      monitoring: records.filter((r) => r.status === "monitoring").length,
      upcomingCheckups: records.filter((r) => r.type === "checkup").length,
      total: records.length,
  };
  }, [records]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
          Загрузка медицинских записей...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-gray-900 mb-2">Медицина</h1>
            <p className="text-gray-600">Учет травм и медицинских показаний</p>
          </div>
          {canWriteInjuries && (
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить запись
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-gray-600">Активные травмы</p>
                <p className="text-gray-900">{stats.activeInjuries}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-gray-600">Под наблюдением</p>
                <p className="text-gray-900">{stats.monitoring}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-600">Предстоящих осмотров</p>
                <p className="text-gray-900">{stats.upcomingCheckups}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-gray-600">Всего записей</p>
                <p className="text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по спортсмену или диагнозу..."
              value={searchQuery}
              onChange={(e) => updateFilterParam("search", e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => updateFilterParam("type", e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все типы</option>
            <option value="injury">Травмы</option>
            <option value="condition">Состояния</option>
            <option value="checkup">Осмотры</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => updateFilterParam("status", e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активна</option>
            <option value="monitoring">Наблюдение</option>
            <option value="completed">Завершено</option>
            <option value="recovered">Восстановлен</option>
          </select>
          <select
            value={order}
            onChange={(e) => {
              const nextOrder = e.target.value;
              setQueryParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("order", nextOrder);
                next.set("page", "1");
                return next;
              });
            }}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Сортировка по дате"
          >
            <option value="desc">Сначала новые</option>
            <option value="asc">Сначала старые</option>
          </select>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Страница <span className="text-gray-900 font-medium">{page}</span> из{" "}
            <span className="text-gray-900 font-medium">{totalPages}</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setQueryParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("page_size", String(nextSize));
                  next.set("page", "1");
                  return next;
                });
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50].map((s) => (
                <option key={s} value={s}>
                  {s} / стр.
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setQueryParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("page", String(nextPage));
                  return next;
                });
              }}
              disabled={page <= 1}
              className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Назад
            </button>
            <button
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                setQueryParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("page", String(nextPage));
                  return next;
                });
              }}
              disabled={page >= totalPages}
              className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Дальше
            </button>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {filteredRecords.map((record) => {
          const Icon = getTypeIcon(record.type);
          return (
            <div
              key={record.id}
              className={`bg-white rounded-xl border-l-4 ${getSeverityColor(record.severity)} p-6 hover:shadow-lg transition-shadow`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white flex-shrink-0">
                  {record.athleteAvatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-gray-900 mb-1">{record.title}</h3>
                      <p className="text-gray-600">{record.athleteName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded ${getTypeColor(record.type)} flex items-center gap-1`}>
                        <Icon className="w-4 h-4" />
                        {getTypeLabel(record.type)}
                      </span>
                      <span className={`px-3 py-1 rounded ${getStatusColor(record.status)}`}>
                        {getStatusLabel(record.status)}
                      </span>
                      {canWriteInjuries && (
                        <>
                          <button
                            onClick={() => handleOpenModal(record)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      )}
                      {canReadFiles && (
                        <button
                          onClick={() => setFilesModalInjuryId(record.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Файлы"
                        >
                          <Paperclip className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{record.description}</p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 mb-1">Дата записи</p>
                      <p className="text-gray-900">{record.dateLabel}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 mb-1">Восстановление</p>
                      <p className="text-gray-900">{record.recovery}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 mb-1">Следующий осмотр</p>
                      <p className="text-gray-900">{record.nextCheckup}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredRecords.length === 0 && total === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-900 mb-2">Записи не найдены</h3>
          <p className="text-gray-600 mb-6">Попробуйте изменить параметры поиска или добавьте новую запись</p>
          {canWriteInjuries && (
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить запись
            </button>
          )}
        </div>
      )}

      {filteredRecords.length === 0 && total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <h3 className="text-gray-900 mb-2">На этой странице нет данных</h3>
          <p className="text-gray-600 mb-6">Попробуйте перейти на другую страницу.</p>
          <button
            onClick={() => {
              setQueryParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("page", "1");
                return next;
              });
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Перейти на 1 страницу
          </button>
        </div>
      )}

      {/* Modal for Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={handleCloseModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {editingRecord ? "Редактировать запись" : "Добавить медицинскую запись"}
              </h3>
              <p className="text-gray-600 text-sm">
                {editingRecord ? "Измените данные медицинской записи" : "Заполните данные для новой медицинской записи"}
              </p>
            </div>
          <div className="grid gap-4 py-4">
            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {saveError}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="athlete_id">Спортсмен *</Label>
              <select
                id="athlete_id"
                value={formData.athlete_id}
                onChange={(e) => setFormData({ ...formData, athlete_id: parseInt(e.target.value, 10) })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={0}>Выберите спортсмена</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {athlete.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание *</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Дата *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="severity">Серьезность</Label>
                <select
                  id="severity"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="minor">Легкая</option>
                  <option value="moderate">Средняя</option>
                  <option value="severe">Тяжелая</option>
                  <option value="critical">Критическая</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Статус</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Активна</option>
                  <option value="monitoring">Наблюдение</option>
                  <option value="completed">Завершено</option>
                  <option value="recovered">Восстановлен</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recovery_time">Время восстановления (дни)</Label>
              <Input
                id="recovery_time"
                type="number"
                value={formData.recovery_time}
                onChange={(e) => setFormData({ ...formData, recovery_time: e.target.value })}
                placeholder="Например, 14"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="medical_notes">Медицинские заметки</Label>
              <textarea
                id="medical_notes"
                value={formData.medical_notes}
                onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Сохранение..." : editingRecord ? "Сохранить" : "Добавить"}
            </button>
          </div>
          <button
            onClick={handleCloseModal}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Закрыть"
          >
            <span className="text-gray-500 text-xl">×</span>
          </button>
        </div>
      </div>
      )}

      {filesModalInjuryId != null && (
        <FileAttachmentsModal
          entityType="injury"
          entityId={filesModalInjuryId}
          onClose={() => setFilesModalInjuryId(null)}
        />
      )}
    </div>
  );
}
