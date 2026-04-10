import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cloud, CloudDrizzle, CloudRain, CloudSun, MapPin, RefreshCw, Sun, Wind } from "lucide-react";

import { formatDate, formatTime } from "../lib/datetime";
import type { WeatherForecastItem, WeatherInsights } from "../types/external";

type Props = {
  weather: WeatherInsights | null;
  weatherDraft: string;
  weatherError: string | null;
  weatherLoading: boolean;
  weatherLocation: string;
  todayItems: WeatherForecastItem[];
  setWeatherDraft: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
};

function getWeatherIcon(condition: string) {
  const value = condition.toLowerCase();
  if (value.includes("rain")) return CloudRain;
  if (value.includes("drizzle")) return CloudDrizzle;
  if (value.includes("cloud")) return Cloud;
  if (value.includes("clear")) return Sun;
  return CloudSun;
}

export function CalendarWeatherPanel({
  weather,
  weatherDraft,
  weatherError,
  weatherLoading,
  weatherLocation,
  todayItems,
  setWeatherDraft,
  onSubmit,
  onRetry,
}: Props) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTime(todayItems[0]?.time ?? null);
  }, [todayItems]);

  const selectedItem = useMemo(
    () => todayItems.find((item) => item.time === selectedTime) ?? todayItems[0] ?? null,
    [selectedTime, todayItems]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            <CloudSun className="h-3.5 w-3.5" />
            Погода на сегодня
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Краткий прогноз из внешнего API</h2>
          <p className="mt-1 text-sm text-slate-500">
            Только на сегодня. Нажмите на время, чтобы посмотреть детали по погоде.
          </p>
        </div>

        <form className="flex w-full max-w-md flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              value={weatherDraft}
              onChange={(event) => setWeatherDraft(event.target.value)}
              placeholder="Например, Moscow"
              className="w-full min-w-0 border-0 bg-transparent py-2.5 text-sm text-slate-800 outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Обновить
          </button>
        </form>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {weatherLoading && (
          <div className="space-y-4">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 w-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          </div>
        )}

        {!weatherLoading && weatherError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Не удалось загрузить прогноз</p>
                  <p className="mt-1 text-sm text-slate-600">{weatherError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
              >
                <RefreshCw className="h-4 w-4" />
                Повторить
              </button>
            </div>
          </div>
        )}

        {!weatherLoading && !weatherError && weather && todayItems.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            На сегодня для <span className="font-medium text-slate-900">{weather.location}</span> нет прогноза.
          </div>
        )}

        {!weatherLoading && !weatherError && weather && todayItems.length > 0 && selectedItem && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-slate-900">
                {weather.location}, {formatDate(new Date())}
              </p>
              <p className="text-xs text-slate-500">
                Источник {weather.source} · обновлено {formatTime(weather.generatedAt)}
              </p>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {todayItems.map((item) => {
                  const isActive = item.time === selectedItem.time;
                  const Icon = getWeatherIcon(item.condition);
                  return (
                    <button
                      key={item.time}
                      type="button"
                      onClick={() => setSelectedTime(item.time)}
                      className={`min-w-[88px] rounded-xl border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-sky-300 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500">{formatTime(item.time)}</span>
                        <Icon className={`h-4 w-4 ${isActive ? "text-sky-700" : "text-slate-500"}`} />
                      </div>
                      <div className="mt-3 text-lg font-semibold text-slate-900">{item.temperatureC}°</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{item.condition}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Время</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{formatTime(selectedItem.time)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Погода</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{selectedItem.condition}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Температура и ветер</p>
                <p className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                  {selectedItem.temperatureC}°C
                  <span className="text-slate-300">·</span>
                  <Wind className="h-4 w-4 text-sky-600" />
                  {selectedItem.windSpeedMps} м/с
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Локация: <span className="font-medium text-slate-700">{weatherLocation}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
