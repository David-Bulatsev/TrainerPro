import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.rbac import Permission, Role, RolePermission, UserRole
from app.models.user import User
from app.schemas.user import TokenPayload

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt."""
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Password is too long for bcrypt (maximum 72 bytes).")

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenPayload(**payload)
    except JWTError:
        raise credentials_exception

    if not token_data.sub:
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.sub).first()
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is deactivated")

    return enrich_user_with_access_data(db, user)


def enrich_user_with_access_data(db: Session, user: User) -> User:
    """Attach RBAC-derived fields used by API response models."""
    role_names = sorted({role.name for role in _get_user_roles(db, user.id)})
    permission_codes = sorted({permission.code for permission in _get_user_permissions(db, role_names)})

    setattr(user, "roles", role_names)
    setattr(user, "permission_codes", permission_codes)
    setattr(user, "permissions", permission_codes)
    return user


def _get_user_roles(db: Session, user_id: int) -> list[Role]:
    role_ids = db.query(UserRole.role_id).filter(UserRole.user_id == user_id).all()
    role_id_list = [role_id for (role_id,) in role_ids]
    if not role_id_list:
        return []

    return db.query(Role).filter(Role.id.in_(role_id_list)).all()


def _get_user_permissions(db: Session, role_names: list[str]) -> list[Permission]:
    if not role_names:
        return []

    roles = db.query(Role).filter(Role.name.in_(role_names)).all()
    role_id_list = [role.id for role in roles]
    if not role_id_list:
        return []

    return (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id.in_(role_id_list))
        .all()
    )
