import os

os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["AUTO_CREATE_TABLES"] = "false"
os.environ["BOOTSTRAP_ADMIN_ENABLED"] = "false"
os.environ["LOGIN_RATE_LIMIT_REQUESTS"] = "1000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.connection import get_db
from app.main import app
from app.models.user import UserRole, UserStatus
from app.schemas.user_schema import UserCreate
from app.services.user_service import create_user


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def override_get_db():
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
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_user(
    db_session,
    *,
    name: str,
    email: str,
    password: str,
    role: UserRole,
    status: UserStatus = UserStatus.active,
):
    return create_user(
        db_session,
        UserCreate(
            name=name,
            email=email,
            password=password,
            role=role,
            status=status,
        ),
    )


@pytest.fixture
def admin_user(db_session):
    return seed_user(
        db_session,
        name="Admin User",
        email="admin@example.com",
        password="Admin123!",
        role=UserRole.admin,
    )


@pytest.fixture
def analyst_user(db_session):
    return seed_user(
        db_session,
        name="Analyst User",
        email="analyst@example.com",
        password="Analyst123!",
        role=UserRole.analyst,
    )


@pytest.fixture
def viewer_user(db_session):
    return seed_user(
        db_session,
        name="Viewer User",
        email="viewer@example.com",
        password="Viewer123!",
        role=UserRole.viewer,
    )


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}


def _login_payload(client: TestClient, email: str, password: str) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def admin_headers(client, admin_user):
    del admin_user
    return _login(client, "admin@example.com", "Admin123!")


@pytest.fixture
def analyst_headers(client, analyst_user):
    del analyst_user
    return _login(client, "analyst@example.com", "Analyst123!")


@pytest.fixture
def viewer_headers(client, viewer_user):
    del viewer_user
    return _login(client, "viewer@example.com", "Viewer123!")


@pytest.fixture
def admin_token_pair(client, admin_user):
    del admin_user
    return _login_payload(client, "admin@example.com", "Admin123!")
