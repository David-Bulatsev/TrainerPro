from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    time = Column(String(10), nullable=True)  # Формат "HH:MM"
    location = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    training_plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    training_plan = relationship("TrainingPlan", back_populates="workouts")
    attendances = relationship("Attendance", back_populates="workout", cascade="all, delete-orphan")

