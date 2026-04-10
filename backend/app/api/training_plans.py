from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.training_plan import TrainingPlan
from app.schemas.training_plan import TrainingPlanCreate, TrainingPlanUpdate, TrainingPlanResponse
from app.core.rbac import require_permission, set_current_user

router = APIRouter(
    prefix="/training-plans",
    tags=["training-plans"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[TrainingPlanResponse],
    dependencies=[Depends(require_permission("training-plans:read"))],
)
def get_training_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список планов тренировок"""
    query = db.query(TrainingPlan)
    
    if search:
        query = query.filter(TrainingPlan.name.ilike(f"%{search}%"))
    
    plans = query.offset(skip).limit(limit).all()
    return plans


@router.get(
    "/{plan_id}",
    response_model=TrainingPlanResponse,
    dependencies=[Depends(require_permission("training-plans:read"))],
)
def get_training_plan(plan_id: int, db: Session = Depends(get_db)):
    """Получить план тренировок по ID"""
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")
    return plan


@router.post(
    "/",
    response_model=TrainingPlanResponse,
    status_code=201,
    dependencies=[Depends(require_permission("training-plans:write"))],
)
def create_training_plan(plan: TrainingPlanCreate, db: Session = Depends(get_db)):
    """Создать новый план тренировок"""
    db_plan = TrainingPlan(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.put(
    "/{plan_id}",
    response_model=TrainingPlanResponse,
    dependencies=[Depends(require_permission("training-plans:write"))],
)
def update_training_plan(
    plan_id: int,
    plan: TrainingPlanUpdate,
    db: Session = Depends(get_db)
):
    """Обновить план тренировок"""
    db_plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Training plan not found")
    
    update_data = plan.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plan, field, value)
    
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.delete(
    "/{plan_id}",
    status_code=204,
    dependencies=[Depends(require_permission("training-plans:write"))],
)
def delete_training_plan(plan_id: int, db: Session = Depends(get_db)):
    """Удалить план тренировок"""
    db_plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Training plan not found")
    
    db.delete(db_plan)
    db.commit()
    return None

