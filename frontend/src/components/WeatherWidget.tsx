import { useEffect, useMemo, useState } from "react";
import { CloudSun, RefreshCw, Wind } from "lucide-react";

import { api } from "../lib/api";
import type { WeatherInsights } from "../types/external";

type Props = {
  location: string;
};

export function WeatherWidget({ location }: Props) {
  const [data, setData] = useState<WeatherInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadWeather() {
      try {
        setLoading(true);
        const response = await api.getWeatherInsights({ location });
        if (ignore) {
          return;
        }
        setData(response);
        setError(null);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Weather data is unavailable");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadWeather();
    return () => {
      ignore = true;
    };
  }, [location]);

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="weather-widget-title">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="weather-widget-title" className="text-gray-900">
            Weather outlook
          </h2>
          <p className="text-sm text-gray-600">
            External forecast for session planning in {data?.location ?? location}
          </p>
        </div>
        <CloudSun className="h-6 w-6 text-sky-600" aria-hidden="true" />
      </div>

      {loading && (
        <div className="flex min-h-32 items-center justify-center rounded-lg bg-slate-50 text-sm text-gray-500">
          Loading forecast...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}. The dashboard continues to work without the external API.
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
          No forecast data was returned for this location.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item.time}
              className="grid gap-3 rounded-lg border border-gray-100 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]"
            >
              <div>
                <h3 className="font-medium text-gray-900">{item.condition}</h3>
                <p className="text-sm text-gray-500">{item.time}</p>
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">{item.temperatureC}°C</span>
                <p className="text-gray-500">Temperature</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Wind className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <div>
                  <span className="font-medium">{item.windSpeedMps} m/s</span>
                  <p className="text-gray-500">Wind</p>
                </div>
              </div>
            </article>
          ))}
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Source: {data?.source ?? "External provider"}
          </p>
        </div>
      )}
    </section>
  );
}

