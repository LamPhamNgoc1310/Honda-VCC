from pydantic import BaseModel, Field
from typing import List, Optional

class PriorityTarget(BaseModel):
    target_zone: str = Field(..., description="The destination zone, e.g., '1.2'")
    weight: int = Field(..., description="Priority ranking. Lower number = higher priority.")

# Schema for creating a new route
class PriorityRuleCreate(BaseModel):
    rule_id: str = Field(..., description="Unique ID, e.g., 'rule_1.1_to_rack'")
    source_zone: str = Field(..., description="Where the call originates")
    move_mode: str = Field(..., description="The mode, e.g., 'to_rack' or 'to_storage'")
    priorities: List[PriorityTarget] = Field(..., description="List of valid targets sorted by weight")

# Schema for partially updating an existing route
class PriorityRuleUpdate(BaseModel):
    rule_id: str = Field(..., description="Required: The ID of the rule to update")
    source_zone: Optional[str] = None
    move_mode: Optional[str] = None
    priorities: Optional[List[PriorityTarget]] = None