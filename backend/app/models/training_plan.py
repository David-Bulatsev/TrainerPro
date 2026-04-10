from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    weeks = Column(Integer, nullable=False, default=1)  # Количество недель
    plan_data = Column(Text, nullable=True)  # JSON данные с деталями плана
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    workouts = relationship("Workout", back_populates="training_plan", cascade="all, delete-orphan")


class TrainingPlanAssignment(Base):
    """Связь между спортсменом и планом тренировок"""
    __tablename__ = "training_plan_assignments"

    id = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)
    training_plan_id = Column(Integer, ForeignKey("training_plans.id"), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

