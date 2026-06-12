from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PointValidationRequest(BaseModel):
    point_id: int = Field(..., description="The physical integer identifier of the selected point")

class ValidTargetPoint(BaseModel):
    point_id: int = Field(..., description="The physical integer identifier of the target point")
    point_name: str = Field(..., alias="node_name", description="The human-readable name of the target point")
    line: str = Field(..., description="The carriage line this point belongs to")

    class Config:
        populate_by_name = True

class PriorityAreaSchema(BaseModel):
    area_name: str = Field(..., description="Name of the zone/area configured by the admin")
    priority: int = Field(..., description="Priority ranking (lower number = higher priority)")
    unfilled_points: List[ValidTargetPoint] = Field(
        ..., 
        description="List of structured, empty target points available in this area"
    )

class PointValidationResponse(BaseModel):
    point_id: int = Field(..., description="The verified source point ID")
    point_name: str = Field(..., alias="node_name", description="The human-readable name of the source point")
    point_type: str = Field(..., alias="node_type", description="The functional type of the point (e.g., 'import', 'supply')")
    line: str = Field(..., description="The line/carriage where this point lives")
    status: str = Field(..., description="Current state of the source point ('filled' or 'empty')")
    checked_at: datetime = Field(..., description="Timestamp of when this validation check occurred")
    possible_areas: List[PriorityAreaSchema] = Field(..., description="Admin-prioritized destination areas")

    class Config:
        populate_by_name = True

class TargetPointInfo(BaseModel):
    point_id: int = Field(..., description="The physical ID of the target point")
    status: str = Field(..., description="Current status of the slot (e.g., 'empty', 'shelf')")
    node_type: str = Field(..., description="Functional type of the point (e.g., 'storage', 'supply')")

class TargetZone(BaseModel):
    is_filled: bool = Field(..., description="The status of a point")
    zone: int = Field(..., description="Priority zone ranking (e.g., 1 is highest)")
    points: List[TargetPointInfo] = Field(..., description="List of available points in this zone")

class PossibleTargetsResponse(BaseModel):
    start_point: int
    time: datetime
    possible_targets: List[TargetZone]

class MoveToPointSchema(BaseModel):
    start_point: int
    target_point: int
    move_mode: str = "to_rack"

class PointUpdateSchema(BaseModel):
    zone: Optional[str]=None
    status: Optional[str]=None

class StartPointSchema(BaseModel):
    start_point: int
    move_mode: str = "to_rack"

class PointSchema(BaseModel):
    point: int
    zone: str