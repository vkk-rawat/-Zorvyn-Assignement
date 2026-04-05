from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.user import UserStatus
from app.schemas.auth_schema import LoginRequest, LogoutRequest, RefreshTokenRequest, TokenResponse
from app.schemas.user_schema import AuthenticatedUserResponse
from app.services.audit_service import log_action
from app.services.user_service import get_user_by_email
from app.utils.security import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    utc_now,
    verify_password,
)


settings = get_settings()


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        log_action(
            db,
            actor_user_id=user.id if user else None,
            action="auth.login",
            entity_type="auth_session",
            status="failure",
            details={"email": email.lower()},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.active:
        log_action(
            db,
            actor_user_id=user.id,
            action="auth.login",
            entity_type="auth_session",
            status="failure",
            entity_id=str(user.id),
            details={"reason": "inactive_user"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive users cannot log in.",
        )

    return user


def _issue_token_pair(db: Session, user: User) -> TokenResponse:
    access_token = create_access_token(subject=str(user.id), extra_claims={"role": user.role.value})
    refresh_token = generate_refresh_token()
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=utc_now() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_record)
    db.commit()
    db.refresh(refresh_record)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        refresh_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
        user=AuthenticatedUserResponse.model_validate(user),
    )


def _get_refresh_token_record(db: Session, raw_refresh_token: str) -> Optional[RefreshToken]:
    token_hash = hash_token(raw_refresh_token)
    return db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))


def login_user(db: Session, payload: LoginRequest) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    response = _issue_token_pair(db, user)
    log_action(
        db,
        actor_user_id=user.id,
        action="auth.login",
        entity_type="auth_session",
        entity_id=str(user.id),
        details={"email": user.email},
    )
    return response


def refresh_user_tokens(db: Session, payload: RefreshTokenRequest) -> TokenResponse:
    token_record = _get_refresh_token_record(db, payload.refresh_token)
    current_time = utc_now()
    expires_at = token_record.expires_at if token_record is not None else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=current_time.tzinfo)

    if token_record is None or token_record.revoked_at is not None or expires_at <= current_time:
        log_action(
            db,
            action="auth.refresh",
            entity_type="auth_session",
            status="failure",
            details={"reason": "invalid_or_expired_refresh_token"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user = token_record.user
    if user.status != UserStatus.active:
        log_action(
            db,
            actor_user_id=user.id,
            action="auth.refresh",
            entity_type="auth_session",
            status="failure",
            entity_id=str(user.id),
            details={"reason": "inactive_user"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive users cannot refresh tokens.",
        )

    token_record.revoked_at = current_time
    db.add(token_record)
    db.commit()

    response = _issue_token_pair(db, user)
    log_action(
        db,
        actor_user_id=user.id,
        action="auth.refresh",
        entity_type="auth_session",
        entity_id=str(user.id),
    )
    return response


def logout_user(db: Session, payload: LogoutRequest) -> None:
    token_record = _get_refresh_token_record(db, payload.refresh_token)
    if token_record is None:
        log_action(
            db,
            action="auth.logout",
            entity_type="auth_session",
            status="failure",
            details={"reason": "refresh_token_not_found"},
        )
        return

    if token_record.revoked_at is None:
        token_record.revoked_at = utc_now()
        db.add(token_record)
        db.commit()

    log_action(
        db,
        actor_user_id=token_record.user_id,
        action="auth.logout",
        entity_type="auth_session",
        entity_id=str(token_record.user_id),
    )
