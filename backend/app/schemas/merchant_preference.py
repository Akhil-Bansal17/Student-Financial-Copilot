import datetime
from pydantic import BaseModel, Field, ConfigDict


class MerchantPreferenceCreate(BaseModel):
    normalized_merchant: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)


class MerchantPreferenceUpdate(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)


class MerchantPreferenceResponse(BaseModel):
    id: int
    user_id: int
    normalized_merchant: str
    category: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
