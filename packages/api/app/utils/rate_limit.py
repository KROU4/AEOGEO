"""Atomic Redis rate limiting via Lua (INCR + EXPIRE in one round-trip)."""

from fastapi import HTTPException, status
from redis.asyncio import Redis

_LUA_INCR_EXPIRE = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
"""


async def enforce_rate_limit(
    redis: Redis,
    *,
    key: str,
    limit: int,
    window_sec: int,
    error_code: str,
    message: str,
) -> None:
    count_raw = await redis.eval(
        _LUA_INCR_EXPIRE,
        1,
        key,
        str(window_sec),
    )
    count = int(count_raw)
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": error_code, "message": message},
        )
