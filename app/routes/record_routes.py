from __future__ import annotations

from datetime import date
from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.role_guard import require_roles
from app.models.financial_record import RecordType
from app.models.user import User, UserRole
from app.schemas.record_schema import RecordCreate, RecordListResponse, RecordResponse, RecordUpdate
from app.services.record_service import (
    create_record,
    delete_record,
    get_record_or_404,
    list_records,
    update_record,
)


router = APIRouter(prefix="/records", tags=["Financial Records"])
read_guard = require_roles(UserRole.analyst, UserRole.admin)
write_guard = require_roles(UserRole.admin)


@router.post(
    "",
    response_model=RecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a financial record",
)
def create_record_endpoint(
    payload: RecordCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> RecordResponse:
    record = create_record(db, payload, created_by=current_user.id)
    return RecordResponse.model_validate(record)


@router.get("", response_model=RecordListResponse, summary="List financial records")
def list_records_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(read_guard)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    category: Optional[str] = Query(default=None, min_length=2, max_length=80),
    category_id: Optional[int] = Query(default=None, ge=1),
    record_type: Optional[RecordType] = Query(default=None, alias="type"),
    search: Optional[str] = Query(default=None, min_length=2, max_length=100),
) -> RecordListResponse:
    del current_user
    records, pagination = list_records(
        db,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        category=category,
        category_id=category_id,
        record_type=record_type,
        search=search,
    )
    return RecordListResponse(
        items=[RecordResponse.model_validate(record) for record in records],
        pagination=pagination,
    )


@router.get("/{record_id}", response_model=RecordResponse, summary="Get a financial record")
def get_record_endpoint(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(read_guard)],
) -> RecordResponse:
    del current_user
    return RecordResponse.model_validate(get_record_or_404(db, record_id))


@router.patch("/{record_id}", response_model=RecordResponse, summary="Update a financial record")
def update_record_endpoint(
    record_id: int,
    payload: RecordUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> RecordResponse:
    record = get_record_or_404(db, record_id)
    return RecordResponse.model_validate(
        update_record(db, record, payload, actor_user_id=current_user.id)
    )


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a record")
def delete_record_endpoint(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(write_guard)],
) -> Response:
    record = get_record_or_404(db, record_id)
    delete_record(db, record, actor_user_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
