from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.nutrition_plan import NutritionPlan
from app.schemas.nutrition_plan import NutritionPlanCreate, NutritionPlanUpdate, NutritionPlanResponse
from app.core.rbac import require_permission, set_current_user

router = APIRouter(
    prefix="/nutrition-plans",
    tags=["nutrition-plans"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[NutritionPlanResponse],
    dependencies=[Depends(require_permission("nutrition-plans:read"))],
)
def get_nutrition_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    athlete_id: Optional[int] = None,
    plan_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список планов питания"""
    query = db.query(NutritionPlan)
    
    if athlete_id:
        query = query.filter(NutritionPlan.athlete_id == athlete_id)
    if plan_type:
        query = query.filter(NutritionPlan.plan_type == plan_type)
    
    plans = query.offset(skip).limit(limit).all()
    return plans


@router.get(
    "/{plan_id}",
    response_model=NutritionPlanResponse,
    dependencies=[Depends(require_permission("nutrition-plans:read"))],
)
def get_nutrition_plan(plan_id: int, db: Session = Depends(get_db)):
    """Получить план питания по ID"""
    plan = db.query(NutritionPlan).filter(NutritionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Nutrition plan not found")
    return plan


@router.post(
    "/",
    response_model=NutritionPlanResponse,
    status_code=201,
    dependencies=[Depends(require_permission("nutrition-plans:write"))],
)
def create_nutrition_plan(plan: NutritionPlanCreate, db: Session = Depends(get_db)):
    """Создать новый план питания"""
    # Проверка существования спортсмена
    from app.models.athlete import Athlete
    
    athlete = db.query(Athlete).filter(Athlete.id == plan.athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    db_plan = NutritionPlan(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.put(
    "/{plan_id}",
    response_model=NutritionPlanResponse,
    dependencies=[Depends(require_permission("nutrition-plans:write"))],
)
def update_nutrition_plan(
    plan_id: int,
    plan: NutritionPlanUpdate,
    db: Session = Depends(get_db)
):
    """Обновить план питания"""
    db_plan = db.query(NutritionPlan).filter(NutritionPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Nutrition plan not found")
    
    update_data = plan.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plan, field, value)
    
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.delete(
    "/{plan_id}",
    status_code=204,
    dependencies=[Depends(require_permission("nutrition-plans:write"))],
)
def delete_nutrition_plan(plan_id: int, db: Session = Depends(get_db)):
    """Удалить план питания"""
    db_plan = db.query(NutritionPlan).filter(NutritionPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Nutrition plan not found")
    
    db.delete(db_plan)
    db.commit()
    return None

