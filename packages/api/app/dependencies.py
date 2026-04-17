import logging
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings
from app.models.role import Role, UserRole
from app.models.user import User
from app.services.auth import AuthService
from app.services.clerk import (
    ClerkAPIError,
    ClerkConfigurationError,
    ClerkIdentity,
    ClerkService,
    ClerkTokenVerificationError,
)

logger = logging.getLogger(__name__)

settings = get_settings()

_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


class _AsyncSessionMakerProxy:
    """Lazy session factory so imports keep one object; init_db() wires the real engine."""

    def __call__(self, *args: object, **kwargs: object) -> AsyncSession:
        if _async_session_factory is None:
            raise RuntimeError(
                "Database engine not initialized; init_db() must run before handling requests "
                "(FastAPI lifespan or Temporal worker startup)."
            )
        # async_sessionmaker is callable; one call yields a new AsyncSession (do not double-call).
        return _async_session_factory(*args, **kwargs)


async_session = _AsyncSessionMakerProxy()


def init_db() -> None:
    """Create the async engine and session factory. Idempotent; safe to call from API lifespan or worker."""
    global _engine, _async_session_factory
    if _engine is not None:
        return
    scheme = settings.database_url.split("://", 1)[0]
    logger.info("Initializing SQLAlchemy async engine (url_scheme=%s)", scheme)
    _engine = create_async_engine(settings.database_url, echo=settings.debug)
    _async_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def dispose_db_engine() -> None:
    """Dispose engine on shutdown (API lifespan)."""
    global _engine, _async_session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _async_session_factory = None

bearer_scheme = HTTPBearer(auto_error=False)

_redis: Redis | None = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth.invalid_token"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


async def get_clerk_identity(
    token: str = Depends(get_bearer_token),
) -> ClerkIdentity:
    clerk = ClerkService(settings)

    try:
        return await clerk.verify_session_token(token)
    except ClerkConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "auth.clerk_not_configured", "message": str(exc)},
        ) from exc
    except ClerkTokenVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth.invalid_token"},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except ClerkAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "auth.identity_unavailable", "message": str(exc)},
        ) from exc


async def get_current_user(
    clerk_identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
) -> User:
    service = AuthService(db, settings=settings)

    try:
        user = await service.resolve_local_user(clerk_identity)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "auth.identity_conflict", "message": str(exc)},
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "auth.bootstrap_required"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth.user_not_found"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_system_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(
        select(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            UserRole.user_id == user.id,
            Role.is_system.is_(True),
            Role.name == "Admin",
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "auth.forbidden"},
        )
    return user
