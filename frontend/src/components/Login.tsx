import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, LogIn, UserPlus } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { routes } from "../lib/routes";
import { SeoPage } from "./SeoPage";

type Mode = "login" | "register";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const isDemoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quickLogin = async (preset: { email: string; password: string }) => {
    setMode("login");
    setEmail(preset.email);
    setPassword(preset.password);
    setLoading(true);
    setError(null);
    try {
      await login(preset.email, preset.password);
      navigate(routes.dashboard);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not sign in"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
        navigate(routes.dashboard);
      } else {
        await register(email, password, fullName || undefined);
        navigate(routes.dashboard);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, mode === "login" ? "Could not sign in" : "Could not create account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SeoPage
      title="Secure login for coaches"
      description="Sign in to the private Trainer Pro workspace to manage athletes, workouts, attendance, and reports."
      path={routes.login}
      noindex
    >
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              {mode === "login" ? <LogIn className="h-8 w-8" /> : <UserPlus className="h-8 w-8" />}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {mode === "login" ? "Вход в систему" : "Регистрация"}
            </h1>
            <p className="text-gray-600">
              {mode === "login" ? "Используйте учетные данные тренера" : "Создайте новый аккаунт тренера"}
            </p>
          </div>

          <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-sm text-red-800 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                <div>
                  <p className="font-medium">Не удалось выполнить вход</p>
                  <p className="mt-1 text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">ФИО</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Иван Петров"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={mode === "login" ? "coach@demo.local" : "coach@example.com"}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Введите пароль"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
              {mode === "register" && <p className="mt-1 text-xs text-gray-500">Минимум 6 символов</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? mode === "login"
                  ? "Вход..."
                  : "Регистрация..."
                : mode === "login"
                  ? "Войти"
                  : "Зарегистрироваться"}
            </button>
          </form>

          {mode === "login" && (
            <>
              {isDemoLoginEnabled && (
                <div className="mt-6 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void quickLogin({ email: "trainer@gmail.com", password: "123123" })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-70"
                  >
                    Войти как тренер (trainer@gmail.com / 123123)
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void quickLogin({ email: "admin@demo.local", password: "admin12" })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-70"
                  >
                    Войти как админ (admin@demo.local / admin12)
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-sm text-gray-600">
                Нет аккаунта?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Зарегистрироваться
                </button>
              </p>
            </>
          )}
        </section>
      </main>
    </SeoPage>
  );
}
