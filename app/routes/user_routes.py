from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.role_guard import require_roles
from app.models.user import User, UserRole
from app.schemas.user_schema import UserCreate, UserListResponse, UserResponse, UserUpdate
from app.services.user_service import (
    create_user,
    deactivate_user,
    get_user_or_404,
    list_users,
    update_user,
)


router = APIRouter(prefix="/users", tags=["Users"])
admin_guard = require_roles(UserRole.admin)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
)
def create_user_endpoint(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
) -> UserResponse:
    return UserResponse.model_validate(create_user(db, payload, actor_user_id=current_user.id))


@router.get("", response_model=UserListResponse, summary="List users")
def list_users_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> UserListResponse:
    del current_user
    users, total = list_users(db, skip=(page - 1) * page_size, limit=page_size)
    return UserListResponse(items=[UserResponse.model_validate(user) for user in users], total=total)


@router.get("/{user_id}", response_model=UserResponse, summary="Get a single user")
def get_user_endpoint(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
) -> UserResponse:
    del current_user
    return UserResponse.model_validate(get_user_or_404(db, user_id))


@router.patch("/{user_id}", response_model=UserResponse, summary="Update a user")
def update_user_endpoint(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
) -> UserResponse:
    user = get_user_or_404(db, user_id)
    return UserResponse.model_validate(update_user(db, user, payload, actor_user_id=current_user.id))


@router.post("/{user_id}/deactivate", response_model=UserResponse, summary="Deactivate a user")
def deactivate_user_endpoint(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
) -> UserResponse:
    user = get_user_or_404(db, user_id)
    return UserResponse.model_validate(deactivate_user(db, user, actor_user_id=current_user.id))
