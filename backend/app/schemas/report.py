from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.report import ReportType


class ReportBase(BaseModel):
    type: str
    title: Optional[str] = None
    data: str  # JSON строка
    parameters: Optional[str] = None  # JSON строка


class ReportCreate(ReportBase):
    pass


class ReportResponse(ReportBase):
    id: int
    generated_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

