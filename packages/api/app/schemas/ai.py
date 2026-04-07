from uuid import UUID

from pydantic import BaseModel


class CompletionRequest(BaseModel):
    provider: str
    model: str
    messages: list[dict]
    request_type: str = "general"
    project_id: UUID | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class CompletionResponse(BaseModel):
    content: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str
