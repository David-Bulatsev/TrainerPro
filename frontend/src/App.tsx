import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Login } from "./components/Login";
import { Sidebar } from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import { ViewProvider } from "./context/ViewContext";
import { routes } from "./lib/routes";

const LandingPage = lazy(() =>
  import("./components/LandingPage").then((module) => ({ default: module.LandingPage }))
);
const Calendar = lazy(() =>
  import("./components/Calendar").then((module) => ({ default: module.Calendar }))
);
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((module) => ({ default: module.Dashboard }))
);
const Athletes = lazy(() =>
  import("./components/Athletes").then((module) => ({ default: module.Athletes }))
);
const Medical = lazy(() =>
  import("./components/Medical").then((module) => ({ default: module.Medical }))
);
const Reports = lazy(() =>
  import("./components/Reports").then((module) => ({ default: module.Reports }))
);
const Workouts = lazy(() =>
  import("./components/Workouts").then((module) => ({ default: module.Workouts }))
);
const NotFoundPage = lazy(() =>
  import("./components/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-600">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Loading page</h1>
        <p className="mt-2 text-sm text-gray-600">Preparing content and route metadata...</p>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Загружаем приложение...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={routes.login} replace />;
  }

  return <>{children}</>;
}

function PermissionProtectedRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={routes.login} replace />;
  }

  const has = (user.permissions ?? []).includes(permission);
  if (!has) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Недостаточно прав для просмотра этой страницы
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppLayout() {
  return (
    <ViewProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<Navigate to={routes.dashboard} replace />} />
            <Route
              path="dashboard"
              element={<PermissionProtectedRoute permission="athletes:read"><Dashboard /></PermissionProtectedRoute>}
            />
            <Route
              path="athletes"
              element={<PermissionProtectedRoute permission="athletes:read"><Athletes /></PermissionProtectedRoute>}
            />
            <Route
              path="workouts"
              element={<PermissionProtectedRoute permission="workouts:read"><Workouts /></PermissionProtectedRoute>}
            />
            <Route
              path="calendar"
              element={<PermissionProtectedRoute permission="workouts:read"><Calendar /></PermissionProtectedRoute>}
            />
            <Route
              path="medical"
              element={<PermissionProtectedRoute permission="injuries:read"><Medical /></PermissionProtectedRoute>}
            />
            <Route
              path="reports"
              element={<PermissionProtectedRoute permission="reports:read"><Reports /></PermissionProtectedRoute>}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </ViewProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={routes.home} element={<LandingPage />} />
          <Route path={routes.login} element={<Login />} />
          <Route
            path={`${routes.app}/*`}
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
