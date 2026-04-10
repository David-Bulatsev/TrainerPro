import { useEffect, useMemo, useState } from "react";
import {
  Download,
  TrendingUp,
  Users,
  Activity,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";
import { safeParseJson } from "../lib/json";
import { routes } from "../lib/routes";
import { useSeo } from "../lib/seo";
import type {
  ApiAthlete,
  ApiAttendance,
  ApiInjury,
  ApiTrainingPlan,
  ApiWorkout,
} from "../types/api";

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"];
const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function Reports() {
  useSeo({
    title: "Reports",
    description: "Private reports and analytics for athletes, attendance, injuries, and planning.",
    path: routes.reports,
    noindex: true,
  });

  const [period, setPeriod] = useState("month");
  const [athletes, setAthletes] = useState<ApiAthlete[]>([]);
  const [workouts, setWorkouts] = useState<ApiWorkout[]>([]);
  const [attendance, setAttendance] = useState<ApiAttendance[]>([]);
  const [injuries, setInjuries] = useState<ApiInjury[]>([]);
  const [plans, setPlans] = useState<ApiTrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const [athletesRes, workoutsRes, attendanceRes, injuriesRes, plansRes] =
          await Promise.all([
            api.getAthletes({ limit: 200 }),
            api.getWorkouts({ limit: 500 }),
            api.getAttendance({ limit: 1000 }),
            api.getInjuries({ limit: 200 }),
            api.getTrainingPlans({ limit: 200 }),
          ]);
        if (ignore) return;
        setAthletes(athletesRes);
        setWorkouts(workoutsRes);
        setAttendance(attendanceRes);
        setInjuries(injuriesRes);
        setPlans(plansRes);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить отчеты"
        );
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
  }, []);

  const planNames = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan.name])),
    [plans]
  );
  const workoutMap = useMemo(
    () => new Map(workouts.map((workout) => [workout.id, workout])),
    [workouts]
  );

  const attendanceTrend = useMemo(() => {
    const map = new Map<string, number>();
    attendance.forEach((record) => {
      const workout = workoutMap.get(record.workout_id);
      if (!workout) return;
      const date = new Date(workout.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!map.has(key)) {
        map.set(key, 0);
      }
      if (record.status === "present") {
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6)
      .map(([key, value]) => ({ month: key.replace("-", "."), value }));
  }, [attendance, workouts]);

  const workoutTypeData = useMemo(() => {
    const map = new Map<string, number>();
    workouts.forEach((workout) => {
      const name = workout.training_plan_id
        ? planNames.get(workout.training_plan_id) ?? "Программа"
        : "Без плана";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length],
    }));
  }, [planNames, workouts]);

  const weeklyActivityData = useMemo(() => {
    const sessionsByDay = new Map(
      WEEK_DAYS.map((day) => [day, { sessions: 0, athletes: 0 }])
    );

    workouts.forEach((workout) => {
      const dow = new Date(workout.date).getDay();
      const normalized = dow === 0 ? 6 : dow - 1;
      const label = WEEK_DAYS[normalized];
      const entry = sessionsByDay.get(label);
      if (entry) {
        entry.sessions += 1;
      }
    });

    attendance.forEach((record) => {
      if (record.status !== "present") return;
      const workout = workoutMap.get(record.workout_id);
      if (!workout) return;
      const dow = new Date(workout.date).getDay();
      const normalized = dow === 0 ? 6 : dow - 1;
      const label = WEEK_DAYS[normalized];
      const entry = sessionsByDay.get(label);
      if (entry) {
        entry.athletes += 1;
      }
    });

    return WEEK_DAYS.map((day) => ({
      day,
      sessions: sessionsByDay.get(day)?.sessions ?? 0,
      athletes: sessionsByDay.get(day)?.athletes ?? 0,
    }));
  }, [attendance, workoutMap, workouts]);

  const athletesProgressData = useMemo(() => {
    return athletes
      .map((athlete) => {
        const meta = safeParseJson<{ attendance?: number }>(
          athlete.contact_info,
          {}
        );
        return { name: athlete.name, progress: meta?.attendance ?? 0 };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 6);
  }, [athletes]);

  const stats = useMemo(() => {
    const presentCount = attendance.filter(
      (record) => record.status === "present"
    ).length;
    const attendanceRate = attendance.length
      ? `${Math.round((presentCount / attendance.length) * 100)}%`
      : "0%";
    const activeInjuries = injuries.filter(
      (injury) => injury.status === "active"
    ).length;
    return [
      {
        label: "Средняя посещаемость",
        value: attendanceRate,
        change: `Присутствий: ${presentCount}`,
        icon: TrendingUp,
        color: "green",
      },
      {
        label: "Активных спортсменов",
        value: athletes.length.toString(),
        change: "Всего в базе",
        icon: Users,
        color: "blue",
      },
      {
        label: "Тренировок проведено",
        value: workouts.length.toString(),
        change: "За весь период",
        icon: Activity,
        color: "purple",
      },
      {
        label: "Активных травм",
        value: activeInjuries.toString(),
        change: "Нужны проверки",
        icon: CalendarIcon,
        color: "orange",
      },
    ];
  }, [athletes.length, attendance, injuries, workouts.length]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
          Формирование отчетов...
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
            <h1 className="text-gray-900 mb-2">Отчеты</h1>
            <p className="text-gray-600">Аналитика и визуализация прогресса</p>
          </div>
          <div className="flex gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="quarter">Квартал</option>
              <option value="year">Год</option>
            </select>
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              onClick={() => {
                const payload = {
                  generated_at: new Date().toISOString(),
                  period,
                  stats: stats.map(({ label, value, change }) => ({
                    label,
                    value,
                    change,
                  })),
                  attendanceTrend,
                  workoutTypeData,
                  weeklyActivityData,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `coach-report-${period}-${Date.now()}.json`;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-5 h-5" />
              Экспорт
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white p-6 rounded-xl border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                  {stat.change}
                </span>
              </div>
              <p className="text-gray-600 mb-1">{stat.label}</p>
              <p className="text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Attendance Trend */}
        {/* <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900">Динамика посещаемости</h3>
            <span className="text-green-600 bg-green-50 px-3 py-1 rounded">Последние месяцы</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ fill: "#3b82f6", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div> */}

        {/* Workout Types Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-gray-900 mb-6">Распределение тренировок</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={workoutTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                dataKey="value"
              >
                {workoutTypeData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Athletes Progress */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-gray-900 mb-6">Прогресс спортсменов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={athletesProgressData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                width={120}
              />
              <Tooltip />
              <Bar dataKey="progress" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity */}
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-gray-900 mb-6">Активность по дням недели</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="sessions"
                fill="#3b82f6"
                name="Тренировок"
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="athletes"
                fill="#10b981"
                name="Спортсменов"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-gray-900">Детальная статистика</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-gray-600">Категория</th>
                <th className="px-6 py-4 text-left text-gray-600">
                  Текущее значение
                </th>
                <th className="px-6 py-4 text-left text-gray-600">
                  Комментарий
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-6 py-4 text-gray-900">Посещаемость</td>
                <td className="px-6 py-4 text-gray-900">{stats[0]?.value}</td>
                <td className="px-6 py-4 text-gray-600">{stats[0]?.change}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-6 py-4 text-gray-900">
                  Количество спортсменов
                </td>
                <td className="px-6 py-4 text-gray-900">{stats[1]?.value}</td>
                <td className="px-6 py-4 text-gray-600">{stats[1]?.change}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-6 py-4 text-gray-900">
                  Проведено тренировок
                </td>
                <td className="px-6 py-4 text-gray-900">{stats[2]?.value}</td>
                <td className="px-6 py-4 text-gray-600">{stats[2]?.change}</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-gray-900">Активные травмы</td>
                <td className="px-6 py-4 text-gray-900">{stats[3]?.value}</td>
                <td className="px-6 py-4 text-gray-600">{stats[3]?.change}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
