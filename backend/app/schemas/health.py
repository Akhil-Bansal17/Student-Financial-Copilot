from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Application operational status")
    environment: str = Field(default="development", description="Current operating environment")
    version: str = Field(default="0.1.0", description="API version")
