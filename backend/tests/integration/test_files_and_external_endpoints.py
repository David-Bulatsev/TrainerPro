import io

import pytest
from fastapi import HTTPException

from tests.conftest import FakeStorage, auth_headers


def create_athlete(client, headers) -> int:
    response = client.post("/athletes/", json={"name": "File Owner"}, headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.integration
def test_file_upload_list_and_delete_flow(client, fake_storage):
    headers = auth_headers(client)
    athlete_id = create_athlete(client, headers)

    upload = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("avatar.png", b"png-bytes", "image/png")},
        data={"entity_type": "athlete", "entity_id": str(athlete_id), "set_as_photo": "true"},
    )
    assert upload.status_code == 201
    payload = upload.json()
    assert payload["original_name"] == "avatar.png"
    assert payload["download_url"].startswith("https://files.test/")
    assert len(fake_storage.uploaded) == 1

    listed = client.get(f"/files/?entity_type=athlete&entity_id={athlete_id}", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == payload["id"]

    deleted = client.delete(f"/files/{payload['id']}", headers=headers)
    assert deleted.status_code == 204
    assert fake_storage.deleted


@pytest.mark.integration
def test_file_validation_errors(client, monkeypatch):
    headers = auth_headers(client)
    athlete_id = create_athlete(client, headers)

    oversized_storage = FakeStorage(max_file_size_bytes=3)
    monkeypatch.setattr("app.api.files.get_storage", lambda: oversized_storage)

    invalid_ext = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("avatar.exe", b"x", "application/octet-stream")},
        data={"entity_type": "athlete", "entity_id": str(athlete_id)},
    )
    assert invalid_ext.status_code == 400

    too_large = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("avatar.png", b"12345", "image/png")},
        data={"entity_type": "athlete", "entity_id": str(athlete_id)},
    )
    assert too_large.status_code == 413

    missing_entity = client.post(
        "/files/upload",
        headers=headers,
        files={"file": ("avatar.png", b"12", "image/png")},
        data={"entity_type": "athlete", "entity_id": "99999"},
    )
    assert missing_entity.status_code == 404


@pytest.mark.integration
def test_external_weather_endpoint_success_and_failure(client, monkeypatch):
    headers = auth_headers(client)

    async def fake_forecast(location: str):
        return {
            "location": location,
            "source": "OpenWeather",
            "generatedAt": "2026-04-10T00:00:00Z",
            "items": [{"time": "2026-04-10 12:00:00", "temperatureC": 18, "windSpeedMps": 4, "condition": "Clear"}],
        }

    monkeypatch.setattr("app.api.external.weather_service.get_forecast", fake_forecast)
    success = client.get("/external/weather?location=Moscow", headers=headers)
    assert success.status_code == 200
    assert success.json()["items"][0]["condition"] == "Clear"

    async def failing_forecast(location: str):
        raise HTTPException(status_code=503, detail="Weather provider is unavailable")

    monkeypatch.setattr("app.api.external.weather_service.get_forecast", failing_forecast)
    failure = client.get("/external/weather?location=Moscow", headers=headers)
    assert failure.status_code == 503
    assert failure.json()["detail"] == "Weather provider is unavailable"
