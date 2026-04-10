from __future__ import annotations

from typing import Iterable, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.core.security import get_current_user
from app.core.security import get_password_hash
from app.models.rbac import Permission, Role, RolePermission, UserRole
from app.models.user import User
 


DEFAULT_ROLES = [
    "user",
    "manager",
    "admin",
]


DEFAULT_PERMISSIONS = [
    # Athletes
    "athletes:read",
    "athletes:write",
    # Training plans
    "training-plans:read",
    "training-plans:write",
    # Workouts / calendar sessions
    "workouts:read",
    "workouts:write",
    # Attendance (marks)
    "attendance:read",
    "attendance:write",
    # Injuries / medical records
    "injuries:read",
    "injuries:write",
    # Nutrition plans
    "nutrition-plans:read",
    "nutrition-plans:write",
    # Reports
    "reports:read",
    "reports:generate",
    # Files
    "files:read",
    "files:write",
    # Admin
    "admin:manage_roles",
]


ROLE_TO_PERMISSIONS: dict[str, list[str]] = {
    "user": [
        "athletes:read",
        "training-plans:read",
        "workouts:read",
        "attendance:read",
        "injuries:read",
        "nutrition-plans:read",
        "reports:read",
        "files:read",
        "files:write",
    ],
    "manager": [
        "athletes:read",
        "athletes:write",
        "training-plans:read",
        "training-plans:write",
        "workouts:read",
        "workouts:write",
        "attendance:read",
        "attendance:write",
        "injuries:read",
        "injuries:write",
        "nutrition-plans:read",
        "nutrition-plans:write",
        "reports:read",
        "reports:generate",
        "files:read",
        "files:write",
    ],
    "admin": [
        "athletes:read",
        "athletes:write",
        "training-plans:read",
        "training-plans:write",
        "workouts:read",
        "workouts:write",
        "attendance:read",
        "attendance:write",
        "injuries:read",
        "injuries:write",
        "nutrition-plans:read",
        "nutrition-plans:write",
        "reports:read",
        "reports:generate",
        "admin:manage_roles",
        "files:read",
        "files:write",
    ],
}


def _ensure_role_permission_graph(db: Session) -> None:
    roles_by_name = {}
    for role_name in DEFAULT_ROLES:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()
        roles_by_name[role_name] = role

    permissions_by_code = {}
    for perm_code in DEFAULT_PERMISSIONS:
        perm = db.query(Permission).filter(Permission.code == perm_code).first()
        if not perm:
            perm = Permission(code=perm_code)
            db.add(perm)
            db.flush()
        permissions_by_code[perm_code] = perm

    # Create missing role->permission edges.
    for role_name, perm_codes in ROLE_TO_PERMISSIONS.items():
        role = roles_by_name[role_name]
        existing = (
            db.query(RolePermission)
            .filter(RolePermission.role_id == role.id)
            .all()
        )
        existing_perm_ids = {rp.permission_id for rp in existing}
        for perm_code in perm_codes:
            perm = permissions_by_code[perm_code]
            if perm.id in existing_perm_ids:
                continue
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))


def _ensure_user_role_assignments(db: Session, default_role_name: str = "user") -> None:
    default_role = db.query(Role).filter(Role.name == default_role_name).first()
    if not default_role:
        return

    # If a user has no roles yet, assign default role.
    users_without_roles = (
        db.query(User)
        .outerjoin(UserRole, UserRole.user_id == User.id)
        .filter(UserRole.user_id.is_(None))
        .all()
    )
    for user in users_without_roles:
        db.add(UserRole(user_id=user.id, role_id=default_role.id))

    # Convenience: seed demo coach as admin (if present).
    demo_user = db.query(User).filter(User.email == "coach@demo.local").first()
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if demo_user and admin_role:
        # Ensure admin mapping exists.
        exists = (
            db.query(UserRole)
            .filter(UserRole.user_id == demo_user.id, UserRole.role_id == admin_role.id)
            .first()
        )
        if not exists:
            db.add(UserRole(user_id=demo_user.id, role_id=admin_role.id))


def _ensure_demo_users(db: Session) -> None:
    """
    Creates demo accounts and assigns roles:
    - trainer@gmail.com / 123123 -> manager
    - admin@demo.local / admin12 -> admin
    """

    demo_accounts = [
        {
            "email": "trainer@gmail.com",
            "full_name": "Demo Trainer",
            "password": "123123",
            "role": "manager",
        },
        {
            "email": "admin@demo.local",
            "full_name": "Demo Admin",
            "password": "admin12",
            "role": "admin",
        },
    ]

    roles = {r.name: r for r in db.query(Role).filter(Role.name.in_(["manager", "admin"])).all()}

    for acc in demo_accounts:
        user = db.query(User).filter(User.email == acc["email"]).first()
        if not user:
            user = User(
                email=acc["email"],
                full_name=acc["full_name"],
                hashed_password=get_password_hash(acc["password"]),
                is_active=True,
            )
            db.add(user)
            db.flush()

        role = roles.get(acc["role"])
        if not role:
            continue
        exists = (
            db.query(UserRole)
            .filter(UserRole.user_id == user.id, UserRole.role_id == role.id)
            .first()
        )
        if not exists:
            db.add(UserRole(user_id=user.id, role_id=role.id))


def ensure_default_rbac(db: Optional[Session] = None) -> None:
    """
    Creates roles/permissions (if missing) and ensures every user has at least one role.
    Safe to call on startup.
    """
    owns_session = db is None
    session = db or SessionLocal()
    try:
        _ensure_role_permission_graph(session)
        _ensure_user_role_assignments(session)
        _ensure_demo_users(session)
        session.commit()
    finally:
        if owns_session:
            session.close()


def set_current_user(request: Request, current_user: User = Depends(get_current_user)) -> None:
    """
    Stores current user in request.state so endpoint permission checks don't re-run JWT+DB lookup.
    """
    request.state.current_user = current_user


def require_permission(permission_code: str):
    def _checker(request: Request) -> None:
        user: Optional[User] = getattr(request.state, "current_user", None)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

        permission_codes: Iterable[str] = getattr(user, "permission_codes", []) or []
        if permission_code not in set(permission_codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )

    return _checker


def require_any_permissions(permission_codes: list[str]):
    def _checker(request: Request) -> None:
        user: Optional[User] = getattr(request.state, "current_user", None)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

        user_perm_codes: Iterable[str] = getattr(user, "permission_codes", []) or []
        if not (set(user_perm_codes) & set(permission_codes)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )

    return _checker

