import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Calendar, Clock, Users, Copy, Edit, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import { safeParseJson } from "../lib/json";
import { formatDate, formatTime, getWeekdayName, isPast } from "../lib/datetime";
import { routes } from "../lib/routes";
import { useSeo } from "../lib/seo";
import type { ApiAttendance, ApiTrainingPlan, ApiWorkout } from "../types/api";
import { useAuth } from "../context/AuthContext";

type Tab = "programs" | "schedule";

type PlanMeta = {
  sessions?: number;
  athletes?: number;
  type?: string;
  status?: string;
  last_updated?: string;
};

type WorkoutProgram = {
  id: number;
  name: string;
  weeks: number;
  sessions: number;
  athletes: number;
  type: string;
  status: string;
  lastUpdated: string;
  description?: string | null;
};

type WorkoutSession = {
  id: number;
  name: string;
  date: Date;
  dateLabel: string;
  time: string;
  dayName: string;
  location: string;
  trainingPlanName?: string;
  status: "completed" | "upcoming";
  athleteCount: number;
  exerciseCount: number;
  stats: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
};

type PlanFormState = {
  name: string;
  description: string;
  weeks: string;
  type: string;
  status: string;
  sessions: string;
  athletes: string;
};

type SessionFormState = {
  name: string;
  date: string;
  time: string;
  location: string;
  trainingPlanId: string;
};

const PLAN_FORM_DEFAULT: PlanFormState = {
  name: "",
  description: "",
  weeks: "8",
  type: "Силовая",
  status: "active",
  sessions: "24",
  athletes: "0",
};

const SESSION_FORM_DEFAULT: SessionFormState = {
  name: "",
  date: "",
  time: "",
  location: "",
  trainingPlanId: "",
};

const WEEK_DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

function mapPlan(plan: ApiTrainingPlan): WorkoutProgram {
  const meta = safeParseJson<PlanMeta>(plan.plan_data, {});
  return {
    id: plan.id,
    name: plan.name,
    weeks: plan.weeks,
    sessions: meta.sessions ?? plan.weeks * 3,
    athletes: meta.athletes ?? 0,
    type: meta.type ?? "Программа",
    status: meta.status ?? "active",
    lastUpdated: meta.last_updated
      ? formatDate(meta.last_updated)
      : formatDate(plan.updated_at ?? plan.created_at),
    description: plan.description,
  };
}

function buildAttendanceMap(records: ApiAttendance[]): Map<number, ApiAttendance[]> {
  const map = new Map<number, ApiAttendance[]>();
  records.forEach((record) => {
    const list = map.get(record.workout_id) ?? [];
    list.push(record);
    map.set(record.workout_id, list);
  });
  return map;
}

function mapWorkout(
  workout: ApiWorkout,
  planMap: Map<number, WorkoutProgram>,
  attendanceMap: Map<number, ApiAttendance[]>
): WorkoutSession {
  const attendance = attendanceMap.get(workout.id) ?? [];
  const present = attendance.filter((record) => record.status === "present").length;
  const absent = attendance.filter((record) => record.status === "absent").length;
  const late = attendance.filter((record) => record.status === "late").length;
  const excused = attendance.filter((record) => record.status === "excused").length;

  const plan = workout.training_plan_id ? planMap.get(workout.training_plan_id) : undefined;
  const baseExercises = plan ? Math.max(4, Math.round(plan.sessions / Math.max(plan.weeks, 1))) : 6;

  const workoutDate = new Date(workout.date);

  return {
    id: workout.id,
    name: workout.description || "Без названия",
    date: workoutDate,
    dateLabel: formatDate(workoutDate),
    time: workout.time || formatTime(workoutDate),
    dayName: getWeekdayName(workoutDate),
    location: workout.location || "Локация не указана",
    trainingPlanName: plan?.name,
    status: isPast(workoutDate) ? "completed" : "upcoming",
    athleteCount: attendance.length,
    exerciseCount: baseExercises,
    stats: { present, absent, late, excused },
  };
}

function getNextDateForDay(dayName: string): string {
  const targetIndex = WEEK_DAYS.indexOf(dayName);
  const today = new Date();
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const diff = (targetIndex - todayIndex + 7) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function Workouts() {
  useSeo({
    title: "Workouts",
    description: "Private training plans and schedule management.",
    path: routes.workouts,
    noindex: true,
  });

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("programs");
  const [searchQuery, setSearchQuery] = useState("");
  const [planRecords, setPlanRecords] = useState<ApiTrainingPlan[]>([]);
  const [workoutRecords, setWorkoutRecords] = useState<ApiWorkout[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<ApiAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormState>(PLAN_FORM_DEFAULT);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(SESSION_FORM_DEFAULT);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canWriteTrainingPlans = user?.permissions?.includes("training-plans:write") ?? false;
  const canWriteWorkouts = user?.permissions?.includes("workouts:write") ?? false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plans, workouts, attendance] = await Promise.all([
        api.getTrainingPlans({ limit: 200 }),
        api.getWorkouts({ limit: 500 }),
        api.getAttendance({ limit: 1000 }),
      ]);
      setPlanRecords(plans);
      setWorkoutRecords(workouts);
      setAttendanceRecords(attendance);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные по тренировкам");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const programs = useMemo(() => planRecords.map(mapPlan), [planRecords]);
  const planMap = useMemo(() => new Map(programs.map((plan) => [plan.id, plan])), [programs]);
  const attendanceMap = useMemo(() => buildAttendanceMap(attendanceRecords), [attendanceRecords]);

  const sessions = useMemo(
    () =>
      workoutRecords
        .map((workout) => mapWorkout(workout, planMap, attendanceMap))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [attendanceMap, planMap, workoutRecords]
  );

  const filteredPrograms = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return programs.filter(
      (program) =>
        program.name.toLowerCase().includes(normalizedQuery) ||
        program.type.toLowerCase().includes(normalizedQuery)
    );
  }, [programs, searchQuery]);

  const scheduleByDay = useMemo(() => {
    const grouped = new Map<string, WorkoutSession[]>();
    WEEK_DAYS.forEach((day) => grouped.set(day, []));
    sessions.forEach((session) => {
      const daySessions = grouped.get(session.dayName) ?? [];
      daySessions.push(session);
      grouped.set(session.dayName, daySessions);
    });

    return WEEK_DAYS.map((day) => ({
      day,
      sessions: (grouped.get(day) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime()),
    }));
  }, [sessions]);

  const resetPlanForm = useCallback(() => {
    setPlanForm(PLAN_FORM_DEFAULT);
    setEditingPlanId(null);
    setActionError(null);
  }, []);

  const resetSessionForm = useCallback(() => {
    setSessionForm(SESSION_FORM_DEFAULT);
    setEditingSessionId(null);
    setActionError(null);
  }, []);

  const openPlanModal = (plan?: ApiTrainingPlan, copy = false) => {
    if (!canWriteTrainingPlans) return;
    if (plan) {
      const meta = safeParseJson<PlanMeta>(plan.plan_data, {});
      setPlanForm({
        name: copy ? `${plan.name} (копия)` : plan.name,
        description: plan.description ?? "",
        weeks: String(plan.weeks),
        type: meta.type ?? "Программа",
        status: meta.status ?? "active",
        sessions: String(meta.sessions ?? plan.weeks * 3),
        athletes: String(meta.athletes ?? 0),
      });
      setEditingPlanId(copy ? null : plan.id);
    } else {
      resetPlanForm();
    }
    setPlanModalOpen(true);
  };

  const handlePlanSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteTrainingPlans) {
      setActionError("Недостаточно прав");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const weeks = Math.max(1, Number(planForm.weeks) || 1);
      const meta = {
        type: planForm.type || "Программа",
        status: planForm.status || "active",
        sessions: Math.max(1, Number(planForm.sessions) || weeks * 3),
        athletes: Math.max(0, Number(planForm.athletes) || 0),
        last_updated: new Date().toISOString(),
      };
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        weeks,
        plan_data: JSON.stringify(meta),
      };

      if (editingPlanId) {
        await api.updateTrainingPlan(editingPlanId, payload);
      } else {
        await api.createTrainingPlan(payload);
      }
      setPlanModalOpen(false);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось сохранить программу");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlanDelete = async (planId: number) => {
    if (!canWriteTrainingPlans) {
      setError("Недостаточно прав");
      return;
    }
    if (!window.confirm("Удалить программу?")) {
      return;
    }
    try {
      await api.deleteTrainingPlan(planId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить программу");
    }
  };

  const openSessionModal = (workout?: ApiWorkout) => {
    if (!canWriteWorkouts) return;
    if (workout) {
      const dateObj = new Date(workout.date);
      const date = dateObj.toISOString().slice(0, 10);
      setSessionForm({
        name: workout.description || "",
        date,
        time: workout.time?.slice(0, 5) ?? "",
        location: workout.location ?? "",
        trainingPlanId: workout.training_plan_id ? String(workout.training_plan_id) : "",
      });
      setEditingSessionId(workout.id);
    } else {
      resetSessionForm();
    }
    setSessionModalOpen(true);
  };

  const handleSessionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionForm.date) {
      setActionError("Выберите дату");
      return;
    }
    if (!canWriteWorkouts) {
      setActionError("Недостаточно прав");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const isoDate = sessionForm.time
        ? new Date(`${sessionForm.date}T${sessionForm.time}`)
        : new Date(`${sessionForm.date}T00:00`);
      const payload = {
        date: isoDate.toISOString(),
        time: sessionForm.time || null,
        location: sessionForm.location || null,
        description: sessionForm.name || null,
        training_plan_id: sessionForm.trainingPlanId ? Number(sessionForm.trainingPlanId) : null,
      };
      if (editingSessionId) {
        await api.updateWorkout(editingSessionId, payload);
      } else {
        await api.createWorkout(payload);
      }
      setSessionModalOpen(false);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось сохранить тренировку");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSessionDelete = async (workoutId: number) => {
    if (!canWriteWorkouts) {
      setError("Недостаточно прав");
      return;
    }
    if (!window.confirm("Удалить тренировку?")) {
      return;
    }
    try {
      await api.deleteWorkout(workoutId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить тренировку");
    }
  };

  const handleQuickSession = (dayName: string) => {
    if (!canWriteWorkouts) return;
    setSessionForm({
      ...SESSION_FORM_DEFAULT,
      date: getNextDateForDay(dayName),
    });
    setSessionModalOpen(true);
    setEditingSessionId(null);
    setActionError(null);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          Загрузка расписания тренировок...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-gray-900">Тренировки</h1>
            <p className="text-gray-600">Управление программами и расписанием</p>
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            )}
          </div>
          {canWriteTrainingPlans && (
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
              onClick={() => openPlanModal()}
            >
              <Plus className="h-5 w-5" />
              Создать программу
            </button>
          )}
        </div>

        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("programs")}
            className={`relative px-4 py-3 transition-colors ${
              activeTab === "programs" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Программы тренировок
            {activeTab === "programs" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`relative px-4 py-3 transition-colors ${
              activeTab === "schedule" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Недельное расписание
            {activeTab === "schedule" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />}
          </button>
        </div>
      </div>

      {activeTab === "programs" && (
        <>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="         Поиск программ..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredPrograms.map((program) => (
              <div key={program.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-gray-900">{program.name}</h3>
                      <span
                        className={`rounded px-2 py-1 text-xs text-white ${
                          program.status === "active" ? "bg-green-500" : "bg-gray-400"
                        }`}
                      >
                        {program.status === "active" ? "Активна" : "Черновик"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{program.description || "Описание отсутствует"}</p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="mb-1 flex items-center justify-center gap-2 text-blue-600">
                      <Calendar className="h-4 w-4" />
                      <span>{program.weeks}</span>
                    </div>
                    <p className="text-sm text-gray-600">недель</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <div className="mb-1 flex items-center justify-center gap-2 text-green-600">
                      <Clock className="h-4 w-4" />
                      <span>{program.sessions}</span>
                    </div>
                    <p className="text-sm text-gray-600">занятий</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-3 text-center">
                    <div className="mb-1 flex items-center justify-center gap-2 text-purple-600">
                      <Users className="h-4 w-4" />
                      <span>{program.athletes}</span>
                    </div>
                    <p className="text-sm text-gray-600">спортсменов</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500">Обновлено: {program.lastUpdated}</p>
                  <div className="flex gap-2">
                    {canWriteTrainingPlans && (
                      <>
                        <button
                          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50"
                          title="Копировать"
                          onClick={() => {
                            const raw = planRecords.find((plan) => plan.id === program.id);
                            if (raw) {
                              openPlanModal(raw, true);
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Редактировать"
                          onClick={() => {
                            const raw = planRecords.find((plan) => plan.id === program.id);
                            if (raw) {
                              openPlanModal(raw);
                            }
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          title="Удалить"
                          onClick={() => handlePlanDelete(program.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!filteredPrograms.length && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-2 text-gray-900">Программы не найдены</h3>
              <p className="text-gray-600">Попробуйте изменить параметры поиска</p>
            </div>
          )}
        </>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-4">
          {scheduleByDay.map((day) => (
            <div key={day.day} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h3 className="text-gray-900">{day.day}</h3>
                {canWriteWorkouts && (
                  <button
                    className="flex items-center gap-2 rounded-lg border border-blue-100 px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-50"
                    onClick={() => handleQuickSession(day.day)}
                  >
                    <Plus className="h-4 w-4" />
                    Добавить
                  </button>
                )}
              </div>
              <div className="p-6">
                {day.sessions.length > 0 ? (
                  <div className="space-y-3">
                    {day.sessions.map((session) => {
                      const rawWorkout = workoutRecords.find((workout) => workout.id === session.id);
                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300"
                        >
                          <div className="min-w-[120px] rounded-lg bg-blue-50 px-4 py-2 text-center">
                            <p className="text-blue-600">{session.time}</p>
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900">{session.name}</p>
                            <p className="text-sm text-gray-500">
                              {session.trainingPlanName || session.location}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-900">{session.exerciseCount}</p>
                            <p className="text-sm text-gray-500">упражнений</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {canWriteWorkouts && (
                              <>
                                <button
                                  className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                                  onClick={() => rawWorkout && openSessionModal(rawWorkout)}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                                  onClick={() => handleSessionDelete(session.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">Занятий не запланировано</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-semibold text-gray-900">
              {editingPlanId ? "Редактирование программы" : "Новая программа"}
            </h3>
            {actionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}
            <form className="space-y-4" onSubmit={handlePlanSubmit}>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Название *</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Описание</label>
                <textarea
                  value={planForm.description}
                  onChange={(event) =>
                    setPlanForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Длительность (недель)</label>
                  <input
                    type="number"
                    min="1"
                    value={planForm.weeks}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, weeks: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Статус</label>
                  <select
                    value={planForm.status}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Активна</option>
                    <option value="draft">Черновик</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Тип</label>
                  <input
                    type="text"
                    value={planForm.type}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, type: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Занятий</label>
                  <input
                    type="number"
                    min="1"
                    value={planForm.sessions}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, sessions: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Спортсменов</label>
                  <input
                    type="number"
                    min="0"
                    value={planForm.athletes}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, athletes: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-50"
                  onClick={() => {
                    setPlanModalOpen(false);
                    resetPlanForm();
                  }}
                  disabled={actionLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-semibold text-gray-900">
              {editingSessionId ? "Редактирование тренировки" : "Новая тренировка"}
            </h3>
            {actionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSessionSubmit}>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Название</label>
                <input
                  type="text"
                  value={sessionForm.name}
                  onChange={(event) =>
                    setSessionForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Дата *</label>
                  <input
                    type="date"
                    value={sessionForm.date}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Время</label>
                  <input
                    type="time"
                    value={sessionForm.time}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, time: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Локация</label>
                  <input
                    type="text"
                    value={sessionForm.location}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, location: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Программа</label>
                  <select
                    value={sessionForm.trainingPlanId}
                    onChange={(event) =>
                      setSessionForm((prev) => ({ ...prev, trainingPlanId: event.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Без программы</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-50"
                  onClick={() => {
                    setSessionModalOpen(false);
                    resetSessionForm();
                  }}
                  disabled={actionLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

