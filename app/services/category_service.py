from __future__ import annotations

from math import ceil
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.financial_record import FinancialRecord, RecordType
from app.schemas.category_schema import CategoryCreate, CategoryUpdate
from app.schemas.common import PaginationMeta
from app.services.audit_service import log_action


def get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with id {category_id} was not found.",
        )
    return category


def get_active_category_for_record(db: Session, category_id: int, record_type: RecordType) -> Category:
    category = get_category_or_404(db, category_id)
    if not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected category is inactive.",
        )
    if category.record_type != record_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The category does not match the selected record type.",
        )
    return category


def ensure_unique_category(
    db: Session,
    *,
    name: str,
    record_type: RecordType,
    exclude_category_id: Optional[int] = None,
) -> None:
    query = select(Category).where(
        Category.name == name,
        Category.record_type == record_type,
    )
    if exclude_category_id is not None:
        query = query.where(Category.id != exclude_category_id)

    if db.scalar(query):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name and record type already exists.",
        )


def create_category(db: Session, payload: CategoryCreate, actor_user_id: Optional[int] = None) -> Category:
    ensure_unique_category(db, name=payload.name, record_type=payload.record_type)

    category = Category(
        name=payload.name,
        record_type=payload.record_type,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="category.create",
        entity_type="category",
        entity_id=str(category.id),
        details={"name": category.name, "record_type": category.record_type.value},
    )
    return category


def list_categories(
    db: Session,
    *,
    page: int,
    page_size: int,
    record_type: Optional[RecordType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
) -> tuple[list[Category], PaginationMeta]:
    conditions = []
    if record_type is not None:
        conditions.append(Category.record_type == record_type)
    if is_active is not None:
        conditions.append(Category.is_active == is_active)
    if search:
        term = f"%{search.strip()}%"
        conditions.append(or_(Category.name.ilike(term), Category.description.ilike(term)))

    total_items = db.scalar(select(func.count(Category.id)).where(*conditions)) or 0
    items = db.scalars(
        select(Category)
        .where(*conditions)
        .order_by(Category.name.asc(), Category.created_at.desc())
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


def update_category(
    db: Session,
    category: Category,
    payload: CategoryUpdate,
    actor_user_id: Optional[int] = None,
) -> Category:
    data = payload.model_dump(exclude_unset=True)
    next_name = data.get("name", category.name)
    next_record_type = data.get("record_type", category.record_type)

    ensure_unique_category(
        db,
        name=next_name,
        record_type=next_record_type,
        exclude_category_id=category.id,
    )

    if (
        "record_type" in data
        and data["record_type"] is not None
        and data["record_type"] != category.record_type
    ):
        linked_records = db.scalar(
            select(func.count(FinancialRecord.id)).where(
                FinancialRecord.category_id == category.id,
                FinancialRecord.deleted_at.is_(None),
            )
        ) or 0
        if linked_records:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change record type for a category that already has records.",
            )

    for field_name, value in data.items():
        setattr(category, field_name, value)

    db.add(category)
    db.commit()
    db.refresh(category)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="category.update",
        entity_type="category",
        entity_id=str(category.id),
        details={"updated_fields": sorted(list(data.keys()))},
    )
    return category


def deactivate_category(db: Session, category: Category, actor_user_id: Optional[int] = None) -> Category:
    category.is_active = False
    db.add(category)
    db.commit()
    db.refresh(category)

    log_action(
        db,
        actor_user_id=actor_user_id,
        action="category.deactivate",
        entity_type="category",
        entity_id=str(category.id),
        details={"name": category.name},
    )
    return category
