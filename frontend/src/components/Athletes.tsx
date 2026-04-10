import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Search,
  Plus,
  Grid3x3,
  List,
  Mail,
  Phone,
  MoreVertical,
  Users,
  Pencil,
} from "lucide-react";
import { api } from "../lib/api";
import type { ApiAthlete } from "../types/api";
import { safeParseJson } from "../lib/json";
import { calculateAge, formatDateTime } from "../lib/datetime";
import { useAuth } from "../context/AuthContext";
import { routes } from "../lib/routes";
import { useSeo } from "../lib/seo";
import { FileAttachmentsModal } from "./FileAttachmentsModal";

type ViewMode = "grid" | "table";

type AthleteMeta = {
  avatar?: string;
  sport?: string;
  status?: string;
  next_session?: string | null;
  attendance?: number;
};

type AthleteCard = {
  id: number;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  ageLabel: string;
  sport: string;
  status: string;
  email: string;
  phone: string;
  nextSession: string;
  attendance: number;
};

type CreateAthleteForm = {
  name: string;
  email: string;
  phone: string;
  sport: string;
  status: string;
  nextSession: string;
  attendance: string;
  avatarFile: File | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "warning", label: "Внимание" },
  { value: "inactive", label: "Неактивен" },
];

const DEFAULT_FORM: CreateAthleteForm = {
  name: "",
  email: "",
  phone: "",
  sport: "",
  status: "active",
  nextSession: "",
  attendance: "80",
  avatarFile: null,
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

function mapAthlete(athlete: ApiAthlete): AthleteCard {
  const meta = safeParseJson<AthleteMeta>(athlete.contact_info, {});
  const age = calculateAge(athlete.birth_date);

  return {
    id: athlete.id,
    name: athlete.name,
    avatar: meta?.avatar || getInitials(athlete.name),
    avatarUrl: athlete.photo && athlete.photo.startsWith("http") ? athlete.photo : null,
    ageLabel: age ? `${age} лет` : "—",
    sport: meta?.sport || "Не указан",
    status: meta?.status || "inactive",
    email: athlete.email || "—",
    phone: athlete.phone || "—",
    nextSession: meta?.next_session ? formatDateTime(meta.next_session) : "Не запланировано",
    attendance: meta?.attendance ?? 0,
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "warning":
      return "bg-yellow-100 text-yellow-700";
    case "inactive":
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function Athletes() {
  useSeo({
    title: "Athletes",
    description: "Private athlete directory with search, filters, and pagination.",
    path: routes.athletes,
    noindex: true,
  });

  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [athletes, setAthletes] = useState<AthleteCard[]>([]);
  const [athletesById, setAthletesById] = useState<Map<number, ApiAthlete>>(new Map());
  const [total, setTotal] = useState(0);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateAthleteForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filesModalAthleteId, setFilesModalAthleteId] = useState<number | null>(null);

  const searchQuery = searchParams.get("search") ?? "";
  const selectedSport = searchParams.get("sport") ?? "all";
  const selectedStatus = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "name";
  const order = searchParams.get("order") ?? "asc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("page_size") ?? "20") || 20));
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const canWriteAthletes = user?.permissions?.includes("athletes:write") ?? false;
  const isEditing = editingAthleteId != null;

  const loadSportsOptions = useCallback(async () => {
    try {
      const data = await api.getAthletes({ limit: 2000 });
      const sportSet = new Set<string>();
      data.forEach((a) => {
        const meta = safeParseJson<AthleteMeta>(a.contact_info, {});
        if (meta?.sport) sportSet.add(meta.sport);
      });
      setSports(Array.from(sportSet).filter(Boolean));
    } catch (err) {
      // Sports list is a best-effort enhancement. Don't block main UI.
      setSports([]);
    }
  }, []);

  useEffect(() => {
    void loadSportsOptions();
  }, [loadSportsOptions]);

  const loadAthletes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAthletesPaged({
        search: searchQuery || undefined,
        sport: selectedSport,
        status: selectedStatus,
        page,
        page_size: pageSize,
        sort,
        order,
      });

      setAthletes(res.items.map(mapAthlete));
      setAthletesById(new Map(res.items.map((a) => [a.id, a])));
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить спортсменов");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSport, selectedStatus, page, pageSize, sort, order]);

  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const filteredAthletes = athletes;

  const updateFilterParam = (key: "search" | "sport" | "status", value: string) => {
    setSearchParams((prev) => {
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

  const getStatusLabel = (value: string) => {
    return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
  };

  const openModal = () => {
    if (!canWriteAthletes) return;
    setFormData(DEFAULT_FORM);
    setFormError(null);
    setEditingAthleteId(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (athleteId: number) => {
    if (!canWriteAthletes) return;
    setFormError(null);
    setEditingAthleteId(athleteId);

    // Use cached list item; fall back to GET by id if missing.
    const existing = athletesById.get(athleteId) ?? (await api.getAthlete(athleteId));
    const meta = safeParseJson<AthleteMeta>(existing.contact_info, {});

    setFormData({
      name: existing.name ?? "",
      email: existing.email ?? "",
      phone: existing.phone ?? "",
      sport: meta?.sport ?? "",
      status: meta?.status ?? "active",
      nextSession: meta?.next_session ?? "",
      attendance: String(meta?.attendance ?? 80),
      avatarFile: null,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
  };

  type StringField = Exclude<keyof CreateAthleteForm, "avatarFile">;
  const handleFormChange = (field: StringField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitAthlete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAthletes) {
      setFormError("Недостаточно прав");
      return;
    }
    if (!formData.name.trim()) {
      setFormError("Имя обязательно");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const attendanceValue = Math.min(100, Math.max(0, Number(formData.attendance) || 0));
      const avatarLabel = getInitials(formData.name.trim());
      const contactInfo = {
        sport: formData.sport || "Не указан",
        status: formData.status,
        next_session: formData.nextSession || null,
        attendance: attendanceValue,
        avatar: avatarLabel,
      };

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        contact_info: JSON.stringify(contactInfo),
      } satisfies Partial<ApiAthlete> & { name: string };

      const saved = isEditing
        ? await api.updateAthlete(editingAthleteId!, payload)
        : await api.createAthlete(payload);

      setIsModalOpen(false);
      if (formData.avatarFile) {
        await api.uploadEntityFile({
          file: formData.avatarFile,
          entity_type: "athlete",
          entity_id: saved.id,
          set_as_photo: true,
        });
      }
      await loadAthletes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : isEditing ? "Не удалось сохранить спортсмена" : "Не удалось создать спортсмена");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
          Загрузка данных спортсменов...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-gray-900 mb-2">Спортсмены</h1>
            <p className="text-gray-600">Управление вашими спортсменами</p>
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-4 text-red-800 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    <div>
                      <p className="font-medium">Не удалось загрузить спортсменов</p>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => void loadAthletes()}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                  >
                    Повторить
                  </button>
                </div>
              </div>
            )}
          </div>
          {canWriteAthletes && (
            <button
              onClick={openModal}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить спортсмена
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени или виду спорта..."
              value={searchQuery}
                onChange={(e) => updateFilterParam("search", e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedSport}
              onChange={(e) => updateFilterParam("sport", e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все виды спорта</option>
            {sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
              onChange={(e) => updateFilterParam("status", e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все статусы</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              const nextSort = e.target.value;
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("sort", nextSort);
                next.set("page", "1");
                return next;
              });
            }}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Сортировка: имя</option>
            <option value="birth_date">Сортировка: дата рождения</option>
            <option value="created_at">Сортировка: создание</option>
          </select>
          <select
            value={order}
            onChange={(e) => {
              const nextOrder = e.target.value;
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("order", nextOrder);
                next.set("page", "1");
                return next;
              });
            }}
            className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            Найдено спортсменов: <span className="text-gray-900">{total}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "table" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
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
                setSearchParams((prev) => {
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
                setSearchParams((prev) => {
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
                setSearchParams((prev) => {
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

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAthletes.map((athlete) => (
            <div
              key={athlete.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white overflow-hidden">
                    {athlete.avatarUrl ? (
                      <img src={athlete.avatarUrl} alt={athlete.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      athlete.avatar
                    )}
                  </div>
                  <div>
                    <h3 className="text-gray-900 mb-1">{athlete.name}</h3>
                    <p className="text-gray-500">{athlete.ageLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canWriteAthletes && (
                    <button
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      onClick={() => void openEditModal(athlete.id)}
                      title="Редактировать"
                    >
                      <Pencil className="w-5 h-5 text-blue-600" />
                    </button>
                  )}
                  <button
                    className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setFilesModalAthleteId(athlete.id)}
                    title="Файлы"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full ${getStatusColor(athlete.status)}`}>
                  {getStatusLabel(athlete.status)}
                </span>
                <span className="ml-2 text-gray-600">{athlete.sport}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{athlete.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{athlete.phone}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Посещаемость</span>
                  <span className="text-gray-900">{athlete.attendance}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                    style={{ width: `${athlete.attendance}%` }}
                  />
                </div>
                <p className="text-gray-500 mt-3">Следующая: {athlete.nextSession}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-gray-600">Спортсмен</th>
                  <th className="px-6 py-4 text-left text-gray-600">Вид спорта</th>
                  <th className="px-6 py-4 text-left text-gray-600">Статус</th>
                  <th className="px-6 py-4 text-left text-gray-600">Контакты</th>
                  <th className="px-6 py-4 text-left text-gray-600">Посещаемость</th>
                  <th className="px-6 py-4 text-left text-gray-600">Следующая тренировка</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {filteredAthletes.map((athlete) => (
                  <tr key={athlete.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white flex-shrink-0 overflow-hidden">
                          {athlete.avatarUrl ? (
                            <img src={athlete.avatarUrl} alt={athlete.name} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            athlete.avatar
                          )}
                        </div>
                        <div>
                          <p className="text-gray-900">{athlete.name}</p>
                          <p className="text-gray-500">{athlete.ageLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{athlete.sport}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full ${getStatusColor(athlete.status)}`}>
                        {getStatusLabel(athlete.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600">{athlete.email}</p>
                      <p className="text-gray-500">{athlete.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-20">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                            style={{ width: `${athlete.attendance}%` }}
                          />
                        </div>
                        <span className="text-gray-900">{athlete.attendance}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{athlete.nextSession}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canWriteAthletes && (
                          <button
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={() => void openEditModal(athlete.id)}
                            title="Редактировать"
                          >
                            <Pencil className="w-5 h-5 text-blue-600" />
                          </button>
                        )}
                        <button
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          onClick={() => setFilesModalAthleteId(athlete.id)}
                          title="Файлы"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredAthletes.length === 0 && total === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-900 mb-2">Спортсмены не найдены</h3>
          <p className="text-gray-600 mb-6">Попробуйте изменить параметры поиска или добавьте нового спортсмена</p>
          <button
            onClick={openModal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить спортсмена
          </button>
        </div>
      )}

      {filteredAthletes.length === 0 && total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <h3 className="text-gray-900 mb-2">На этой странице нет данных</h3>
          <p className="text-gray-600 mb-6">Попробуйте перейти на другую страницу.</p>
          <button
            onClick={() => {
              setSearchParams((prev) => {
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {isEditing ? "Редактирование спортсмена" : "Новый спортсмен"}
            </h3>
            {formError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-red-800 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <div>
                    <p className="font-medium">Не удалось сохранить данные</p>
                    <p className="mt-1 text-sm text-red-700">{formError}</p>
                  </div>
                </div>
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSubmitAthlete}>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Имя *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Вид спорта</label>
                  <input
                    type="text"
                    value={formData.sport}
                    onChange={(e) => handleFormChange("sport", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Статус</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange("status", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Следующая тренировка</label>
                  <input
                    type="datetime-local"
                    value={formData.nextSession}
                    onChange={(e) => handleFormChange("nextSession", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Посещаемость (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.attendance}
                    onChange={(e) => handleFormChange("attendance", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Аватар (файл)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, avatarFile: e.target.files?.[0] ?? null }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Опционально. Поддерживаемые типы: `png/jpg/jpeg`. Максимум 10MB.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filesModalAthleteId != null && (
        <FileAttachmentsModal
          entityType="athlete"
          entityId={filesModalAthleteId}
          onClose={() => setFilesModalAthleteId(null)}
        />
      )}
    </div>
  );
}
