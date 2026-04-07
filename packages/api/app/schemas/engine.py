from pydantic import BaseModel


class EngineCreate(BaseModel):
    name: str
    slug: str
    provider: str
    icon_url: str | None = None


class EngineUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class EngineResponse(BaseModel):
    id: str
    name: str
    slug: str
    provider: str
    is_active: bool
    icon_url: str | None
