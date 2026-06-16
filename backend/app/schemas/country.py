from pydantic import BaseModel
from typing import Optional

class CountryBase(BaseModel):
    code: str
    name: str
    region: Optional[str] = None

class CountryResponse(CountryBase):
    id: int

    class Config:
        from_attributes = True  # Tells Pydantic to read ORM objects from SQLAlchemy
