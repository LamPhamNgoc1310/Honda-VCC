from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Example:
#     {
#     "source_zone": "1.1",
#     "move_mode": "to_rack",
#     "priorities": [
#         { "target_zone": "1.2", "order": 1 },
#         { "target_zone": "4", "order": 2 },
#         { "target_zone": "6", "order": 3 }
#     ]
#     }



class TargetZoneSchema(BaseModel):
    target_zone: str = Field(..., description="This is the target zone.")
    priority: int = Field(..., description="This is the priority of the target zone, prioritized by ascending order.")

class BaseZoneSchema(BaseModel):
    source_zone: str = Field(..., description="The original zone calling for a task.")
    move_mode: str = Field(..., description="The classification of move mode to shortlist the required zones.")
    priorities: List[TargetZoneSchema] = Field(..., description="This is the priority zones lists.")

class ZoneCreate(BaseModel):
    zone_id: str = Field(..., description="The unique identifier for the zone, e.g., '1.1' or 'Zone 2'")
    description: Optional[str] = Field(None, description="Optional description of the zone's purpose")
    is_active: bool = Field(True, description="Whether the zone is currently active")

class ZoneUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ZoneResponse(BaseModel):
    zone_id: str
    description: Optional[str] = None
    is_active: bool
    is_deleted: bool
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    updatedBy: str