import pytest

from tests.conftest import auth_headers


@pytest.mark.integration
def test_athlete_crud_and_paged_filters(client):
    headers = auth_headers(client)

    created = client.post(
        "/athletes/",
        json={
            "name": "Ivan Sprinter",
            "email": "ivan@example.com",
            "contact_info": '{"sport":"Sprint","status":"active"}',
        },
        headers=headers,
    )
    assert created.status_code == 201
    athlete_id = created.json()["id"]

    fetched = client.get(f"/athletes/{athlete_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Ivan Sprinter"

    paged = client.get("/athletes/paged?search=Sprint&sport=Sprint&status=active&page=1&page_size=20", headers=headers)
    assert paged.status_code == 200
    payload = paged.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == athlete_id


@pytest.mark.integration
def test_athlete_permissions_and_validation(client):
    headers = auth_headers(client)
    not_found = client.get("/athletes/99999", headers=headers)
    assert not_found.status_code == 404

    unauthenticated = client.get("/athletes/")
    assert unauthenticated.status_code == 401

    client.post("/auth/register", json={"email": "readonly2@example.com", "password": "123456"})
    readonly_headers = auth_headers(client, "readonly2@example.com", "123456")
    forbidden = client.post("/athletes/", json={"name": "Blocked User"}, headers=readonly_headers)
    assert forbidden.status_code == 403
