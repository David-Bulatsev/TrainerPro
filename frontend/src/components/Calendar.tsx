import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit, Plus, Trash2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatDate, formatTime } from "../lib/datetime";
import type { ApiTrainingPlan, ApiWorkout } from "../types/api";
import type { WeatherForecastItem, WeatherInsights } from "../types/external";
import { CalendarWeatherPanel } from "./CalendarWeatherPanel";

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEK_DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const EVENT_STYLES = [
  {
    badge: "bg-blue-500 text-white",
    border: "border-blue-500",
    chip: "bg-blue-50 text-blue-700",
  },
  {
    badge: "bg-emerald-500 text-white",
    border: "border-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
  },
  {
    badge: "bg-violet-500 text-white",
    border: "border-violet-500",
    chip: "bg-violet-50 text-violet-700",
  },
  {
    badge: "bg-amber-500 text-white",
    border: "border-amber-500",
    chip: "bg-amber-50 text-amber-700",
  },
  {
    badge: "bg-cyan-500 text-white",
    border: "border-cyan-500",
    chip: "bg-cyan-50 text-cyan-700",
  },
] as const;

type CalendarEvent = {
  id: number;
  workout: ApiWorkout;
  style: (typeof EVENT_STYLES)[number];
};

type SessionFormState = {
  name: string;
  date: string;
  time: string;
  location: string;
  trainingPlanId: string;
};

const SESSION_FORM_DEFAULT: SessionFormState = {
  name: "",
  date: "",
  time: "",
  location: "",
  trainingPlanId: "",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function Calendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(formatKey(new Date()));
  const [workouts, setWorkouts] = useState<ApiWorkout[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<ApiTrainingPlan[]>([]);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(SESSION_FORM_DEFAULT);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherLocation, setWeatherLocation] = useState("Moscow");
  const [weatherDraft, setWeatherDraft] = useState("Moscow");
  const [weather, setWeather] = useState<WeatherInsights | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const canWriteWorkouts = user?.permissions?.includes("workouts:write") ?? false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [workoutsRes, plansRes] = await Promise.all([
        api.getWorkouts({ limit: 500 }),
        api.getTrainingPlans({ limit: 200 }),
      ]);
      setWorkouts(workoutsRes);
      setTrainingPlans(plansRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить календарь");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadWeather = useCallback(async (location: string) => {
    try {
      setWeatherLoading(true);
      const response = await api.getWeatherInsights({ location });
      setWeather(response);
      setWeatherError(null);
    } catch (err) {
      setWeather(null);
      setWeatherError(err instanceof Error ? err.message : "Не удалось получить прогноз погоды");
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeather(weatherLocation);
  }, [loadWeather, weatherLocation]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    workouts.forEach((workout) => {
      const key = formatKey(new Date(workout.date));
      const styleIndex = (workout.training_plan_id ?? 0) % EVENT_STYLES.length;
      const event: CalendarEvent = {
        id: workout.id,
        workout,
        style: EVENT_STYLES[styleIndex],
      };
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(event);
    });
    return grouped;
  }, [workouts]);

  const weatherItemsByDate = useMemo(() => {
    const grouped: Record<string, WeatherForecastItem[]> = {};
    (weather?.items ?? []).forEach((item) => {
      const key = formatKey(new Date(item.time));
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }, [weather]);

  const selectedEvents = selectedDateKey ? eventsByDate[selectedDateKey] ?? [] : [];
  const todayKey = formatKey(new Date());
  const todayWeatherItems = weatherItemsByDate[todayKey] ?? [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const handleSelectDate = (dayKey: string) => {
    setSelectedDateKey(dayKey);
  };

  const days = useMemo(() => {
    const cells: JSX.Element[] = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-[112px]" />);
    }

    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayKey = `${monthKey}-${String(day).padStart(2, "0")}`;
      const dayEvents = eventsByDate[dayKey] ?? [];
      const isSelected = selectedDateKey === dayKey;
      const isToday = formatKey(new Date()) === dayKey;
      cells.push(
        <button
          key={dayKey}
          type="button"
          onClick={() => handleSelectDate(dayKey)}
          className={`min-h-[112px] border p-3 text-left transition-colors ${
            isSelected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                isToday ? "bg-blue-600 text-white" : "bg-slate-100 text-gray-700"
              }`}
            >
              {day}
            </div>
            <div className="flex flex-col items-end gap-1">
              {dayEvents.length > 0 && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                  {dayEvents.length}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 2).map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={(eventClick) => {
                  eventClick.stopPropagation();
                  openSessionModal(event.workout);
                }}
                className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${event.style.badge}`}
              >
                {formatTime(event.workout.time || event.workout.date)} {event.workout.description || "Тренировка"}
              </button>
            ))}
            {dayEvents.length > 2 && <div className="text-xs text-gray-500">+{dayEvents.length - 2} еще</div>}
          </div>
        </button>
      );
    }

    return cells;
  }, [daysInMonth, eventsByDate, firstDay, month, selectedDateKey, year]);

  const resetSessionForm = () => {
    setSessionForm(SESSION_FORM_DEFAULT);
    setEditingWorkoutId(null);
    setActionError(null);
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
      setEditingWorkoutId(workout.id);
    } else if (selectedDateKey) {
      setSessionForm({
        ...SESSION_FORM_DEFAULT,
        date: selectedDateKey,
      });
      setEditingWorkoutId(null);
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
      if (editingWorkoutId) {
        await api.updateWorkout(editingWorkoutId, payload);
      } else {
        await api.createWorkout(payload);
      }
      setSessionModalOpen(false);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось сохранить событие");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorkout = async (workoutId: number) => {
    if (!canWriteWorkouts) {
      setError("Недостаточно прав");
      return;
    }
    if (!window.confirm("Удалить событие?")) {
      return;
    }
    try {
      await api.deleteWorkout(workoutId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить событие");
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDateKey(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDateKey(null);
  };

  const handleWeatherSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLocation = weatherDraft.trim();
    if (!nextLocation) {
      return;
    }
    setWeatherLocation(nextLocation);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-5 w-44 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Календарь</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Планируйте тренировки и сразу проверяйте погодное окно по дням, чтобы быстрее понимать, когда лучше ставить
            открытые занятия.
          </p>
          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        {canWriteWorkouts && (
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            onClick={() => openSessionModal()}
          >
            <Plus className="h-4 w-4" />
            Добавить событие
          </button>
        )}
      </div>

      <CalendarWeatherPanel
        weather={weather}
        weatherDraft={weatherDraft}
        weatherError={weatherError}
        weatherLoading={weatherLoading}
        weatherLocation={weatherLocation}
        todayItems={todayWeatherItems}
        setWeatherDraft={setWeatherDraft}
        onSubmit={handleWeatherSubmit}
        onRetry={() => void loadWeather(weatherLocation)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {MONTHS[month]} {year}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Выберите день, чтобы посмотреть события и привязанный прогноз</p>
            </div>
            <div className="flex gap-2">
              <button onClick={previousMonth} className="rounded-2xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={nextMonth} className="rounded-2xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-7 gap-2 text-center text-sm font-medium text-slate-500">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="py-2 text-sm">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">{days}</div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">
            {selectedDateKey ? `События ${formatDate(selectedDateKey)}` : "Выберите день"}
          </h3>
          {selectedDateKey && (
            <>
              {selectedEvents.length ? (
                <div className="mt-5 space-y-3">
                  {selectedEvents.map((event) => (
                    <div key={event.id} className={`rounded-2xl border-l-4 ${event.style.border} bg-slate-50 p-4`}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{event.workout.description || "Тренировка"}</p>
                          <p className="text-sm text-slate-500">{event.workout.location || "Без локации"}</p>
                        </div>
                        {canWriteWorkouts && (
                          <div className="flex gap-2">
                            <button
                              className="rounded-xl p-2 text-blue-600 transition-colors hover:bg-blue-50"
                              onClick={() => openSessionModal(event.workout)}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded-xl p-2 text-red-600 transition-colors hover:bg-red-50"
                              onClick={() => handleDeleteWorkout(event.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className={`rounded-full px-2.5 py-1 ${event.style.chip}`}>
                          {formatTime(event.workout.time || event.workout.date)}
                        </span>
                        {event.workout.training_plan_id && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200">
                            План #{event.workout.training_plan_id}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-slate-500">На выбранный день пока нет событий</p>
                  {canWriteWorkouts && (
                    <button
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
                      onClick={() => openSessionModal()}
                    >
                      <Plus className="h-4 w-4" />
                      Добавить событие
                    </button>
                  )}
                </div>
              )}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h4 className="text-base font-semibold text-slate-900">Статистика дня</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Всего событий</p>
                    <div className="mt-1 text-3xl font-semibold text-slate-900">{selectedEvents.length}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Есть погодный прогноз</p>
                    <div className="mt-1 text-3xl font-semibold text-slate-900">{selectedDateKey === todayKey && todayWeatherItems.length ? "Да" : "Нет"}</div>
                  </div>
                </div>
              </div>
            </>
          )}
          {!selectedDateKey && <div className="py-10 text-center text-slate-500">Выберите день в календаре</div>}
        </div>
      </div>

      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">{editingWorkoutId ? "Редактирование события" : "Новое событие"}</h3>
            {actionError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSessionSubmit}>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Название</label>
                <input
                  type="text"
                  value={sessionForm.name}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Дата *</label>
                  <input
                    type="date"
                    value={sessionForm.date}
                    onChange={(event) => setSessionForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Время</label>
                  <input
                    type="time"
                    value={sessionForm.time}
                    onChange={(event) => setSessionForm((prev) => ({ ...prev, time: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Локация</label>
                  <input
                    type="text"
                    value={sessionForm.location}
                    onChange={(event) => setSessionForm((prev) => ({ ...prev, location: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Программа</label>
                  <select
                    value={sessionForm.trainingPlanId}
                    onChange={(event) => setSessionForm((prev) => ({ ...prev, trainingPlanId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">Без программы</option>
                    {trainingPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-600 transition-colors hover:bg-slate-50"
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
                  className="rounded-2xl bg-slate-900 px-6 py-2 text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
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
