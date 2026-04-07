from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_clerk_identity, get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    BootstrapRequest,
    InviteRequest,
    InviteResponse,
    MessageResponse,
    TeamMemberResponse,
    UserResponse,
)
from app.services.auth import AuthService
from app.services.clerk import ClerkIdentity

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(user: User, permissions: list[str]) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        tenant_id=str(user.tenant_id),
        permissions=permissions,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = AuthService(db)
    permissions = await service.get_permissions_for_user(current_user.id)
    return _to_user_response(current_user, permissions)


@router.post("/bootstrap", response_model=UserResponse)
async def bootstrap(
    body: BootstrapRequest,
    clerk_identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = AuthService(db)

    try:
        user = await service.bootstrap_clerk_user(
            clerk_identity,
            company_name=body.company_name,
            preferred_name=body.name,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "company_name_required":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "auth.company_name_required"},
            ) from exc
        if code == "clerk_identity_conflict":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "auth.identity_conflict"},
            ) from exc
        raise

    permissions = await service.get_permissions_for_user(user.id)
    return _to_user_response(user, permissions)


@router.post("/invite", response_model=InviteResponse)
async def invite(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InviteResponse:
    service = AuthService(db)

    try:
        result = await service.create_invite(
            email=body.email,
            inviter=current_user,
            role_id=body.role_id,
            project_id=body.project_id,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "email_taken":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "auth.email_taken"},
            ) from exc
        if code == "cannot_invite_self":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "auth.cannot_invite_self"},
            ) from exc
        if code == "role_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "auth.role_not_found"},
            ) from exc
        if code == "project_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "auth.project_not_found"},
            ) from exc
        raise

    return InviteResponse(**result)


@router.get("/team", response_model=list[TeamMemberResponse])
async def team(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TeamMemberResponse]:
    service = AuthService(db)
    members = await service.list_team(current_user)
    return [TeamMemberResponse(**member) for member in members]


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    return MessageResponse(message="Signed out")
