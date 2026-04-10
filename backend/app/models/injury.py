from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class InjurySeverity(str, enum.Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class Injury(Base):
    __tablename__ = "injuries"

    id = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    date = Column(Date, nullable=False, index=True)
    severity = Column(String(20), nullable=False, default=InjurySeverity.MINOR.value)
    recovery_time = Column(Integer, nullable=True)  # Дней на восстановление
    medical_notes = Column(Text, nullable=True)
    status = Column(String(50), nullable=True, default="active")  # active, recovered, chronic
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    athlete = relationship("Athlete", back_populates="injuries")

