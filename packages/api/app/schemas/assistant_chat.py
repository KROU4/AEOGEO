"""Assistant chat / streaming payloads."""

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(max_length=32000)


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=16000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=40)
