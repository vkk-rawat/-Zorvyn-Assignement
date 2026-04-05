from __future__ import annotations

from datetime import date
from math import ceil
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.category import Category
from app.models.financial_record import FinancialRecord, RecordType
from app.schemas.common import PaginationMeta
from app.schemas.record_schema import RecordCreate, RecordUpdate
from app.services.audit_service import log_action
from app.services.category_service import get_active_category_for_record
from app.utils.security import utc_now
from app.utils.validators import ensure_valid_date_range


def _build_conditions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    category_id: Optional[int] = None,
    record_type: Optional[RecordType] = None,
    search: Optional[str] = None,
):
    ensure_valid_date_range(start_date, end_date)

    conditions = [FinancialRecord.deleted_at.is_(None)]
    if start_date:
        conditions.append(FinancialRecord.date >= start_date)
    if end_date:
        conditions.append(FinancialRecord.date <= end_date)
    if category:
        conditions.append(Category.name == category.strip())
    if category_id:
        conditions.append(FinancialRecord.category_id == category_id)
    if record_type:
        conditions.append(FinancialRecord.type == record_type)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Category.name.ilike(term),
                FinancialRecord.notes.ilike(term),
            )
        )
    return conditions


def get_record_or_404(db: Session, record_id: int) -> FinancialRecord:
    record = db.scalar(
        select(FinancialRecord)
        .options(selectinload(FinancialRecord.category))
        .where(
            FinancialRecord.id == record_id,
            FinancialRecord.deleted_at.is_(None),
        )
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial record with id {record_id} was not found.",
        )
    return record


def create_record(db: Session, payload: RecordCreate, created_by: int) -> FinancialRecord:
    category = get_active_category_for_record(db, payload.category_id, payload.type)
    record = FinancialRecord(
        amount=payload.amount,
        type=payload.type,
        category_id=category.id,
        date=payload.date,
        notes=payload.notes,
        created_by=created_by,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    record = get_record_or_404(db, record.id)
    log_action(
        db,
        actor_user_id=created_by,
        action="record.create",
        entity_type="financial_record",
        entity_id=str(record.id),
        details={"category_id": record.category_id, "type": record.type.value, "amount": str(record.amount)},
    )
    return record


def list_records(
    db: Session,
    *,
    page: int,
    page_size: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    category_id: Optional[int] = None,
    record_type: Optional[RecordType] = None,
    search: Optional[str] = None,
) -> tuple[list[FinancialRecord], PaginationMeta]:
    conditions = _build_conditions(start_date, end_date, category, category_id, record_type, search)

    total_items = db.scalar(
        select(func.count(FinancialRecord.id))
        .select_from(FinancialRecord)
        .join(Category)
        .where(*conditions)
    ) or 0
    items = db.scalars(
        select(FinancialRecord)
        .join(Category)
        .options(selectinload(FinancialRecord.category))
        .where(*conditions)
        .order_by(FinancialRecord.date.desc(), FinancialRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    pagination = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=max(1, ceil(total_items / page_size)) if page_size else 1,
    )
    return items, pagination


def update_record(
    db: Session,
    record: FinancialRecord,
    payload: RecordUpdate,
    actor_user_id: Optional[int] = None,
) -> FinancialRecord:
    data = payload.model_dump(exclude_unset=True)
    next_type = data.get("type", record.type)
    next_category_id = data.get("category_id", record.category_id)
    if "type" in data or "category_id" in data:
        category = get_active_category_for_record(db, next_category_id, next_type)
        record.category_id = category.id

    for field_name, value in data.items():
        if field_name == "category_id":
            continue
        setattr(record, field_name, value)

    db.add(record)
    db.commit()
    record = get_record_or_404(db, record.id)
    log_action(
        db,
        actor_user_id=actor_user_id,
        action="record.update",
        entity_type="financial_record",
        entity_id=str(record.id),
        details={"updated_fields": sorted(list(data.keys()))},
    )
    return record


def delete_record(db: Session, record: FinancialRecord, actor_user_id: Optional[int] = None) -> None:
    record.deleted_at = utc_now()
    db.add(record)
    db.commit()
    log_action(
        db,
        actor_user_id=actor_user_id,
        action="record.delete",
        entity_type="financial_record",
        entity_id=str(record.id),
        details={"category_id": record.category_id},
    )
