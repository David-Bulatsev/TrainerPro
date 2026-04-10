import pytest
from fastapi import HTTPException

from app.services.weather import InMemoryRateLimiter, WeatherService


@pytest.mark.unit
@pytest.mark.asyncio
async def test_weather_service_normalizes_provider_response(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WEATHER_API_KEY", "abc")
    monkeypatch.setenv("WEATHER_FORECAST_LIMIT", "2")
    service = WeatherService()

    calls: list[str] = []

    async def fake_request(client, path: str, params: dict):
        calls.append(path)
        if "geo" in path:
            return [{"name": "Moscow", "country": "RU", "lat": 55.7, "lon": 37.6}]
        return {
            "list": [
                {
                    "dt_txt": "2026-04-10 12:00:00",
                    "main": {"temp": 16.3},
                    "wind": {"speed": 3.4},
                    "weather": [{"main": "Clouds"}],
                },
                {
                    "dt_txt": "2026-04-10 15:00:00",
                    "main": {"temp": 18.1},
                    "wind": {"speed": 4.0},
                    "weather": [{"main": "Clear"}],
                },
            ]
        }

    monkeypatch.setattr(service, "_request_with_retries", fake_request)

    payload = await service.get_forecast("Moscow")

    assert calls == ["/geo/1.0/direct", "/data/2.5/forecast"]
    assert payload["location"] == "Moscow, RU"
    assert payload["source"] == "OpenWeather"
    assert payload["items"][0]["temperatureC"] == 16.3
    assert payload["items"][1]["condition"] == "Clear"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_weather_service_requires_api_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("WEATHER_API_KEY", raising=False)
    service = WeatherService()

    with pytest.raises(HTTPException) as exc:
        await service.get_forecast("Moscow")

    assert exc.value.status_code == 503
    assert exc.value.detail == "Weather integration is not configured"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rate_limiter_blocks_excess_requests():
    limiter = InMemoryRateLimiter(limit=1, window_seconds=60)

    await limiter.acquire()

    with pytest.raises(HTTPException) as exc:
        await limiter.acquire()

    assert exc.value.status_code == 429
