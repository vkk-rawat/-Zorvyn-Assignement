from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.config import get_settings
from app.models.user import User, UserRole, UserStatus
from app.schemas.user_schema import UserCreate, UserUpdate
from app.services.audit_service import log_action
from app.utils.security import get_password_hash


settings = get_settings()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} was not found.",
        )
    return user


def ensure_unique_email(db: Session, email: str, exclude_user_id: Optional[int] = None) -> None:
    query = select(User).where(User.email == email.lower())
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)

    if db.scalar(query):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )


def _ensure_not_last_active_admin(
    db: Session,
    user: User,
    target_role: Optional[UserRole] = None,
    target_status: Optional[UserStatus] = None,
) -> None:
    next_role = target_role or user.role
    next_status = target_status or user.status

    if user.role != UserRole.admin or user.status != UserStatus.active:
        return

    if next_role == UserRole.admin and next_status == UserStatus.active:
        return

    remaining_admins = db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.admin,
            User.status == UserStatus.active,
            User.id != user.id,
        )
    )

    if not remaining_admins:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate or demote the last active admin.",
        )


def create_user(db: Session, payload: UserCreate, actor_user_id: Optional[int] = None) -> User:
    ensure_unique_email(db, payload.email)

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        status=payload.status,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="user.create",
        entity_type="user",
        entity_id=str(user.id),
        details={"email": user.email, "role": user.role.value, "status": user.status.value},
    )
    return user


def list_users(db: Session, skip: int, limit: int) -> tuple[list[User], int]:
    total = db.scalar(select(func.count(User.id))) or 0
    users = db.scalars(select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)).all()
    return users, total


def update_user(
    db: Session,
    user: User,
    payload: UserUpdate,
    actor_user_id: Optional[int] = None,
) -> User:
    data = payload.model_dump(exclude_unset=True)

    if "email" in data and data["email"]:
        ensure_unique_email(db, data["email"], exclude_user_id=user.id)
        user.email = data["email"].lower()

    if "role" in data or "status" in data:
        _ensure_not_last_active_admin(
            db,
            user,
            target_role=data.get("role"),
            target_status=data.get("status"),
        )

    if "name" in data:
        user.name = data["name"]
    if "password" in data and data["password"]:
        user.password_hash = get_password_hash(data["password"])
    if "role" in data and data["role"] is not None:
        user.role = data["role"]
    if "status" in data and data["status"] is not None:
        user.status = data["status"]

    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="user.update",
        entity_type="user",
        entity_id=str(user.id),
        details={"updated_fields": sorted(list(data.keys()))},
    )
    return user


def deactivate_user(db: Session, user: User, actor_user_id: Optional[int] = None) -> User:
    _ensure_not_last_active_admin(db, user, target_status=UserStatus.inactive)
    user.status = UserStatus.inactive
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="user.deactivate",
        entity_type="user",
        entity_id=str(user.id),
        details={"email": user.email},
    )
    return user


def ensure_bootstrap_admin(db: Session) -> Optional[User]:
    if not settings.bootstrap_admin_enabled:
        return None
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return None

    existing_admin = db.scalar(
        select(User).where(
            User.role == UserRole.admin,
            User.status == UserStatus.active,
        )
    )
    if existing_admin:
        return existing_admin

    admin = User(
        name=settings.bootstrap_admin_name,
        email=settings.bootstrap_admin_email.lower(),
        password_hash=get_password_hash(settings.bootstrap_admin_password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
