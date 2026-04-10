from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.workout import Workout
from app.schemas.workout import WorkoutCreate, WorkoutUpdate, WorkoutResponse
from app.core.rbac import require_permission, set_current_user

router = APIRouter(
    prefix="/workouts",
    tags=["workouts"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[WorkoutResponse],
    dependencies=[Depends(require_permission("workouts:read"))],
)
def get_workouts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    training_plan_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Получить список тренировок"""
    query = db.query(Workout)
    
    if start_date:
        query = query.filter(Workout.date >= start_date)
    if end_date:
        query = query.filter(Workout.date <= end_date)
    if training_plan_id:
        query = query.filter(Workout.training_plan_id == training_plan_id)
    
    workouts = query.order_by(Workout.date).offset(skip).limit(limit).all()
    return workouts


@router.get(
    "/{workout_id}",
    response_model=WorkoutResponse,
    dependencies=[Depends(require_permission("workouts:read"))],
)
def get_workout(workout_id: int, db: Session = Depends(get_db)):
    """Получить тренировку по ID"""
    workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.post(
    "/",
    response_model=WorkoutResponse,
    status_code=201,
    dependencies=[Depends(require_permission("workouts:write"))],
)
def create_workout(workout: WorkoutCreate, db: Session = Depends(get_db)):
    """Создать новую тренировку"""
    db_workout = Workout(**workout.model_dump())
    db.add(db_workout)
    db.commit()
    db.refresh(db_workout)
    return db_workout


@router.put(
    "/{workout_id}",
    response_model=WorkoutResponse,
    dependencies=[Depends(require_permission("workouts:write"))],
)
def update_workout(
    workout_id: int,
    workout: WorkoutUpdate,
    db: Session = Depends(get_db)
):
    """Обновить тренировку"""
    db_workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not db_workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    update_data = workout.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_workout, field, value)
    
    db.commit()
    db.refresh(db_workout)
    return db_workout


@router.delete(
    "/{workout_id}",
    status_code=204,
    dependencies=[Depends(require_permission("workouts:write"))],
)
def delete_workout(workout_id: int, db: Session = Depends(get_db)):
    """Удалить тренировку"""
    db_workout = db.query(Workout).filter(Workout.id == workout_id).first()
    if not db_workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    db.delete(db_workout)
    db.commit()
    return None

