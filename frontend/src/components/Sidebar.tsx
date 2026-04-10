import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Dumbbell, CalendarDays, Heart, BarChart3, LogOut } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { routes } from "../lib/routes";

const menuItems = [
  { path: routes.dashboard, icon: LayoutDashboard, label: "Дашборд", permission: null },
  { path: routes.athletes, icon: Users, label: "Спортсмены", permission: "athletes:read" },
  { path: routes.workouts, icon: Dumbbell, label: "Тренировки", permission: "workouts:read" },
  { path: routes.calendar, icon: CalendarDays, label: "Календарь", permission: "workouts:read" },
  { path: routes.medical, icon: Heart, label: "Медицина", permission: "injuries:read" },
  { path: routes.reports, icon: BarChart3, label: "Отчеты", permission: "reports:read" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const permissions = user?.permissions ?? [];

  const initials =
    user?.full_name
      ?.split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || user?.email.charAt(0).toUpperCase();

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-blue-600">Тренер Pro</h1>
        <p className="text-sm text-gray-500">Панель управления</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            if (item.permission && !permissions.includes(item.permission)) {
              return null;
            }

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                    isActive ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-white">
            {initials}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{user?.full_name ?? user?.email}</p>
            <p className="text-xs text-gray-500">Главный тренер</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
