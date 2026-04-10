import { useEffect, useMemo, useState } from "react";
import { Users, Dumbbell, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { formatTime } from "../lib/datetime";
import { safeParseJson } from "../lib/json";
import { useSeo } from "../lib/seo";
import { routes } from "../lib/routes";
import type { ApiAthlete, ApiAttendance, ApiWorkout } from "../types/api";
import { WeatherWidget } from "./WeatherWidget";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Stat = {
  label: string;
  value: string;
  change: string;
  icon: typeof Users;
};

type RecentAthlete = {
  name: string;
  status: string;
  progress: number;
  avatar: string;
};

type UpcomingSession = {
  time: string;
  name: string;
  athletes: number;
  type: string;
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

export function Dashboard() {
  useSeo({
    title: "Dashboard",
    description: "Private dashboard for athletes, attendance, workouts, and planning.",
    path: routes.dashboard,
    noindex: true,
  });

  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<ApiAthlete[]>([]);
  const [workouts, setWorkouts] = useState<ApiWorkout[]>([]);
  const [attendance, setAttendance] = useState<ApiAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        setLoading(true);
        const [athletesRes, workoutsRes, attendanceRes] = await Promise.all([
          api.getAthletes({ limit: 200 }),
          api.getWorkouts({ limit: 500 }),
          api.getAttendance({ limit: 1000 }),
        ]);
        if (ignore) {
          return;
        }
        setAthletes(athletesRes);
        setWorkouts(workoutsRes);
        setAttendance(attendanceRes);
        setError(null);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const workoutMap = useMemo(() => new Map(workouts.map((workout) => [workout.id, workout])), [workouts]);

  const stats = useMemo<Stat[]>(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekAhead = now + 7 * 24 * 60 * 60 * 1000;

    const recentWorkouts = workouts.filter((workout) => {
      const ts = new Date(workout.date).getTime();
      return ts >= weekAgo && ts <= now;
    }).length;
    const upcomingWorkouts = workouts.filter((workout) => {
      const ts = new Date(workout.date).getTime();
      return ts >= now && ts <= weekAhead;
    }).length;
    const presentCount = attendance.filter((record) => record.status === "present").length;
    const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

    return [
      { label: "Athletes", value: String(athletes.length), change: `${presentCount} present marks`, icon: Users },
      { label: "Upcoming workouts", value: String(upcomingWorkouts), change: "Next 7 days", icon: Dumbbell },
      { label: "Attendance rate", value: `${attendanceRate}%`, change: `${attendance.length} records`, icon: TrendingUp },
      { label: "Workouts this week", value: String(recentWorkouts), change: "Last 7 days", icon: CalendarIcon },
    ];
  }, [athletes.length, attendance, workouts]);

  const attendanceData = useMemo(() => {
    const counts = new Map(WEEKDAY_LABELS.map((label) => [label, 0]));
    attendance.forEach((record) => {
      if (record.status !== "present") {
        return;
      }
      const workout = workoutMap.get(record.workout_id);
      if (!workout) {
        return;
      }
      const day = new Date(workout.date).getDay();
      const index = day === 0 ? 6 : day - 1;
      const label = WEEKDAY_LABELS[index];
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return WEEKDAY_LABELS.map((label) => ({ day: label, value: counts.get(label) ?? 0 }));
  }, [attendance, workoutMap]);

  const upcomingSessions = useMemo<UpcomingSession[]>(() => {
    const attendanceByWorkout = new Map<number, number>();
    attendance.forEach((record) => {
      attendanceByWorkout.set(record.workout_id, (attendanceByWorkout.get(record.workout_id) ?? 0) + 1);
    });

    return workouts
      .filter((workout) => new Date(workout.date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4)
      .map((workout) => ({
        time: formatTime(workout.time || workout.date),
        name: workout.description || "Workout session",
        athletes: attendanceByWorkout.get(workout.id) ?? 0,
        type: workout.location || "Location not specified",
      }));
  }, [attendance, workouts]);

  const recentAthletes = useMemo<RecentAthlete[]>(() => {
    return athletes
      .map((athlete) => {
        const meta = safeParseJson<{ avatar?: string; status?: string; attendance?: number }>(athlete.contact_info, {});
        return {
          name: athlete.name,
          status: meta?.status ?? "active",
          progress: meta?.attendance ?? 0,
          avatar: meta?.avatar || getInitials(athlete.name),
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4);
  }, [athletes]);

  const weatherLocation = upcomingSessions[0]?.type || "Moscow";

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <main className="p-8">
      <header className="mb-8">
        <h1 className="mb-2 text-gray-900">Team dashboard</h1>
        <p className="text-gray-600">Overview of athlete operations, attendance, upcoming sessions, and weather context.</p>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}
      </header>

      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" aria-label="Main metrics">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                </div>
                <span className="rounded bg-green-50 px-2 py-1 text-green-600">{stat.change}</span>
              </div>
              <h2 className="mb-1 text-sm text-gray-600">{stat.label}</h2>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </article>
          );
        })}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-6 text-gray-900">Attendance by weekday</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={attendanceData}>
              <defs>
                <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#0284c7" fillOpacity={1} fill="url(#attendanceFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-6 text-gray-900">Top athlete activity</h2>
          <div className="space-y-4">
            {recentAthletes.map((athlete) => (
              <section key={athlete.name} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-white">
                  {athlete.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-gray-900">{athlete.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${athlete.status === "warning" ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${athlete.progress}%` }}
                      />
                    </div>
                    <span className="text-gray-500">{athlete.progress}%</span>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-8">
        <WeatherWidget location={weatherLocation} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-gray-900">Upcoming sessions</h2>
          <button
            className="rounded-lg px-4 py-2 text-blue-600 transition-colors hover:bg-blue-50"
            onClick={() => navigate(routes.workouts)}
          >
            Open workouts
          </button>
        </div>
        <div className="space-y-3">
          {upcomingSessions.map((session, index) => (
            <article
              key={`${session.name}-${index}`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300"
            >
              <div className="rounded-lg bg-blue-50 px-4 py-2 text-center">
                <p className="text-blue-600">{session.time}</p>
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900">{session.name}</h3>
                <p className="text-gray-500">{session.type}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-900">{session.athletes}</p>
                <p className="text-sm text-gray-500">Athletes</p>
              </div>
            </article>
          ))}
          {upcomingSessions.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-gray-500">
              No upcoming sessions scheduled yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
