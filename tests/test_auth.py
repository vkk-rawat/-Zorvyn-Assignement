from app.models.user import UserRole, UserStatus
from app.schemas.user_schema import UserCreate
from app.services.user_service import create_user


def test_login_returns_token_for_active_user(client, db_session):
    create_user(
        db_session,
        UserCreate(
            name="Finance Admin",
            email="finance.admin@example.com",
            password="Admin123!",
            role=UserRole.admin,
            status=UserStatus.active,
        ),
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "finance.admin@example.com", "password": "Admin123!"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "admin"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["refresh_expires_in"] > body["expires_in"]


def test_login_rejects_inactive_user(client, db_session):
    create_user(
        db_session,
        UserCreate(
            name="Inactive Admin",
            email="inactive.admin@example.com",
            password="Admin123!",
            role=UserRole.admin,
            status=UserStatus.inactive,
        ),
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "inactive.admin@example.com", "password": "Admin123!"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Inactive users cannot log in."


def test_refresh_rotates_tokens_and_logout_revokes_refresh_token(client, db_session):
    create_user(
        db_session,
        UserCreate(
            name="Refresh Admin",
            email="refresh.admin@example.com",
            password="Admin123!",
            role=UserRole.admin,
            status=UserStatus.active,
        ),
    )

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh.admin@example.com", "password": "Admin123!"},
    )
    assert login_response.status_code == 200
    login_body = login_response.json()

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_body["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refresh_body = refresh_response.json()
    assert refresh_body["refresh_token"] != login_body["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_body["refresh_token"]},
    )
    assert logout_response.status_code == 200

    revoked_refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_body["refresh_token"]},
    )
    assert revoked_refresh_response.status_code == 401
