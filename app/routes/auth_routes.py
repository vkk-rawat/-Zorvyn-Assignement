from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_active_user
from app.models.user import User
from app.schemas.auth_schema import LoginRequest, LogoutRequest, RefreshTokenRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.schemas.user_schema import AuthenticatedUserResponse
from app.services.auth_service import login_user, logout_user, refresh_user_tokens


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, summary="Authenticate a user")
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    return login_user(db, payload)


@router.post("/refresh", response_model=TokenResponse, summary="Rotate refresh token and get a new token pair")
def refresh_token(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    return refresh_user_tokens(db, payload)


@router.post("/logout", response_model=MessageResponse, summary="Revoke a refresh token")
def logout(
    payload: LogoutRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    logout_user(db, payload)
    return MessageResponse(message="Logout completed successfully.")


@router.get("/me", response_model=AuthenticatedUserResponse, summary="Get the current user")
def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse.model_validate(current_user)
