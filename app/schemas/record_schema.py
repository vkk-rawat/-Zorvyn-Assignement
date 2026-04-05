from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.financial_record import RecordType
from app.schemas.category_schema import CategoryResponse
from app.schemas.common import PaginationMeta
from app.utils.validators import normalize_optional_text, normalize_text


class RecordBase(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    type: RecordType
    category_id: int = Field(..., ge=1)
    date: date
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class RecordCreate(RecordBase):
    pass


class RecordUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    type: Optional[RecordType] = None
    category_id: Optional[int] = Field(default=None, ge=1)
    date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class RecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Decimal
    type: RecordType
    category_id: int
    category_name: str
    category: CategoryResponse
    date: date
    notes: Optional[str]
    created_by: int
    created_at: datetime
    updated_at: datetime


class RecordListResponse(BaseModel):
    items: list[RecordResponse]
    pagination: PaginationMeta
