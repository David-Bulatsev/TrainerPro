from __future__ import annotations

import asyncio
import os
import time
from collections import deque

import httpx
from fastapi import HTTPException, status


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._timestamps: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            while self._timestamps and now - self._timestamps[0] > self.window_seconds:
                self._timestamps.popleft()

            if len(self._timestamps) >= self.limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="External weather requests are temporarily rate-limited",
                )

            self._timestamps.append(now)


class WeatherService:
    def __init__(self) -> None:
        self.api_key = os.getenv("WEATHER_API_KEY", "").strip()
        self.base_url = os.getenv("WEATHER_API_BASE_URL", "https://api.openweathermap.org").rstrip("/")
        self.timeout_seconds = float(os.getenv("WEATHER_TIMEOUT_SECONDS", "8"))
        self.max_retries = int(os.getenv("WEATHER_MAX_RETRIES", "2"))
        self.forecast_limit = int(os.getenv("WEATHER_FORECAST_LIMIT", "5"))
        self.rate_limiter = InMemoryRateLimiter(
            limit=int(os.getenv("WEATHER_RATE_LIMIT", "20")),
            window_seconds=int(os.getenv("WEATHER_RATE_WINDOW_SECONDS", "60")),
        )

    async def get_forecast(self, location: str) -> dict:
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Weather integration is not configured",
            )

        await self.rate_limiter.acquire()
        timeout = httpx.Timeout(self.timeout_seconds)

        async with httpx.AsyncClient(timeout=timeout) as client:
            coordinates = await self._request_with_retries(
                client,
                "/geo/1.0/direct",
                {"q": location, "limit": 1, "appid": self.api_key},
            )

            if not coordinates:
                return {
                    "location": location,
                    "source": "OpenWeather",
                    "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "items": [],
                }

            city = coordinates[0]
            forecast = await self._request_with_retries(
                client,
                "/data/2.5/forecast",
                {
                    "lat": city["lat"],
                    "lon": city["lon"],
                    "appid": self.api_key,
                    "units": "metric",
                },
            )

        items = []
        for item in forecast.get("list", [])[: self.forecast_limit]:
            weather = item.get("weather") or [{}]
            items.append(
                {
                    "time": item.get("dt_txt"),
                    "temperatureC": round(float(item.get("main", {}).get("temp", 0)), 1),
                    "windSpeedMps": round(float(item.get("wind", {}).get("speed", 0)), 1),
                    "condition": weather[0].get("main", "Unknown"),
                }
            )

        resolved_name = ", ".join(
            part for part in [city.get("name"), city.get("state"), city.get("country")] if part
        )

        return {
            "location": resolved_name or location,
            "source": "OpenWeather",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "items": items,
        }

    async def _request_with_retries(self, client: httpx.AsyncClient, path: str, params: dict) -> dict | list:
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.get(f"{self.base_url}{path}", params=params)
                response.raise_for_status()
                return response.json()
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as error:
                last_error = error
                if attempt >= self.max_retries:
                    break
                await asyncio.sleep(min(1.5, 0.4 * (attempt + 1)))

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Weather provider is unavailable",
        ) from last_error


weather_service = WeatherService()
