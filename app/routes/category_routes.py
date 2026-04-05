from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.role_guard import require_roles
from app.models.financial_record import RecordType
from app.models.user import User, UserRole
from app.schemas.category_schema import (
    CategoryCreate,
    CategoryListResponse,
    CategoryResponse,
    CategoryUpdate,
)
from app.services.category_service import (
    create_category,
    deactivate_category,
    get_category_or_404,
    list_categories,
    update_category,
)


router = APIRouter(prefix="/categories", tags=["Categories"])
read_guard = require_roles(UserRole.viewer, UserRole.analyst, UserRole.admin)
write_guard = require_roles(UserRole.admin)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, summary="Create a category")
def create_category_endpoint(
    payload: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> CategoryResponse:
    category = create_category(db, payload, actor_user_id=current_user.id)
    return CategoryResponse.model_validate(category)


@router.get("", response_model=CategoryListResponse, summary="List categories")
def list_categories_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(read_guard)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    record_type: Optional[RecordType] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None, min_length=2, max_length=100),
) -> CategoryListResponse:
    del current_user
    categories, pagination = list_categories(
        db,
        page=page,
        page_size=page_size,
        record_type=record_type,
        is_active=is_active,
        search=search,
    )
    return CategoryListResponse(
        items=[CategoryResponse.model_validate(category) for category in categories],
        pagination=pagination,
    )


@router.get("/{category_id}", response_model=CategoryResponse, summary="Get a category")
def get_category_endpoint(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(read_guard)],
) -> CategoryResponse:
    del current_user
    return CategoryResponse.model_validate(get_category_or_404(db, category_id))


@router.patch("/{category_id}", response_model=CategoryResponse, summary="Update a category")
def update_category_endpoint(
    category_id: int,
    payload: CategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> CategoryResponse:
    category = get_category_or_404(db, category_id)
    updated = update_category(db, category, payload, actor_user_id=current_user.id)
    return CategoryResponse.model_validate(updated)


@router.post("/{category_id}/deactivate", response_model=CategoryResponse, summary="Deactivate a category")
def deactivate_category_endpoint(
    category_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> CategoryResponse:
    category = get_category_or_404(db, category_id)
    return CategoryResponse.model_validate(
        deactivate_category(db, category, actor_user_id=current_user.id)
    )
