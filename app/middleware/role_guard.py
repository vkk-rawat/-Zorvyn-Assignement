from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User, UserRole


def require_roles(*allowed_roles: UserRole):
    def role_dependency(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return role_dependency
