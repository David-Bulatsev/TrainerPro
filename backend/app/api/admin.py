from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rbac import require_permission, set_current_user
from app.database import get_db
from app.models.rbac import Role, UserRole
from app.models.user import User

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(set_current_user)],
)


class AssignRoleRequest(BaseModel):
    role: str


@router.post(
    "/users/{user_id}/role",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("admin:manage_roles"))],
)
def assign_user_role(
    user_id: int,
    payload: AssignRoleRequest,
    db: Session = Depends(get_db),
):
    """
    Назначить роль пользователю.
    Доступ: только admin.
    """
    # Permission guard is declarative and kept in dependencies below.
    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail="Unknown role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Remove previous role assignments (single-role model for now).
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role_id=role.id))
    db.commit()

    return {"user_id": user_id, "role": role.name}

