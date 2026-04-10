from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
from sqlalchemy.sql import func
import enum
from app.database import Base


class ReportType(str, enum.Enum):
    ATTENDANCE = "attendance"
    PROGRESS = "progress"
    INJURIES = "injuries"
    NUTRITION = "nutrition"
    GENERAL = "general"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=True)
    data = Column(Text, nullable=False)  # JSON данные отчета
    generated_date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    parameters = Column(Text, nullable=True)  # JSON параметры, использованные для генерации
    created_at = Column(DateTime(timezone=True), server_default=func.now())

