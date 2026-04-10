from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


TEST_DB_PATH = Path(__file__).resolve().parent / "test_app.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["WEATHER_API_KEY"] = "test-api-key"

from app.core.rbac import ensure_default_rbac
from app.database import Base, get_db
from app.main import app


class FakeStorage:
    def __init__(self, max_file_size_bytes: int = 10 * 1024 * 1024) -> None:
        self.max_file_size_bytes = max_file_size_bytes
        self.uploaded: dict[str, bytes] = {}
        self.deleted: list[str] = []

    def upload_bytes(self, *, key: str, content: bytes, content_type: str | None, content_length: int) -> None:
        self.uploaded[key] = content

    def generate_presigned_download_url(self, *, key: str):
        return type("PresignResult", (), {"url": f"https://files.test/{key}"})()

    def delete_object(self, *, key: str) -> None:
        self.deleted.append(key)
        self.uploaded.pop(key, None)


engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        ensure_default_rbac(db)
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    fake_storage = FakeStorage()
    monkeypatch.setattr("app.api.files.get_storage", lambda: fake_storage)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def fake_storage(monkeypatch: pytest.MonkeyPatch):
    storage = FakeStorage()
    monkeypatch.setattr("app.api.files.get_storage", lambda: storage)
    return storage


def auth_headers(client: TestClient, email: str = "trainer@gmail.com", password: str = "123123") -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
