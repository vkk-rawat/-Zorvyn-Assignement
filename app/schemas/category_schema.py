from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.financial_record import RecordType
from app.schemas.common import PaginationMeta
from app.utils.validators import normalize_optional_text, normalize_text


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    record_type: RecordType
    description: Optional[str] = Field(default=None, max_length=300)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalize_text(value, "name")

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    record_type: Optional[RecordType] = None
    description: Optional[str] = Field(default=None, max_length=300)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return normalize_text(value, "name")

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        return normalize_optional_text(value)


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    record_type: RecordType
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoryListResponse(BaseModel):
    items: list[CategoryResponse]
    pagination: PaginationMeta
