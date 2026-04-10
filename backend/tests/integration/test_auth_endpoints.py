import pytest

from tests.conftest import auth_headers


@pytest.mark.integration
def test_register_login_and_profile_flow(client):
    register = client.post(
        "/auth/register",
        json={"email": "qa@example.com", "password": "123456", "full_name": "QA User"},
    )
    assert register.status_code == 201
    assert register.json()["email"] == "qa@example.com"
    assert "user" in register.json()["roles"]
    assert "workouts:read" in register.json()["permissions"]

    login = client.post("/auth/login", json={"email": "qa@example.com", "password": "123456"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    payload = me.json()
    assert payload["email"] == "qa@example.com"
    assert "user" in payload["roles"]
    assert "workouts:read" in payload["permissions"]


@pytest.mark.integration
def test_auth_validation_and_permission_failures(client):
    invalid_register = client.post("/auth/register", json={"email": "bad@example.com", "password": "1"})
    assert invalid_register.status_code == 422

    invalid_login = client.post("/auth/login", json={"email": "trainer@gmail.com", "password": "wrong"})
    assert invalid_login.status_code == 401

    client.post("/auth/register", json={"email": "readonly@example.com", "password": "123456"})
    readonly_headers = auth_headers(client, "readonly@example.com", "123456")
    forbidden = client.post("/admin/users/1/role", json={"role": "admin"}, headers=readonly_headers)
    assert forbidden.status_code == 403
