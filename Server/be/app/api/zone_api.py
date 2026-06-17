from dataclasses import asdict
from typing import Any

from shared.logging import get_logger
from fastapi import APIRouter, HTTPException
import os
from app.services.vcc_logic import moveToPoint, get_possible_targets, create_new_point, get_all_points, update_point_data  # example name
from schemas.TargetPointSchema import MoveToPointSchema, PossibleTargetsResponse, StartPointSchema, PointSchema, PointUpdateSchema
from schemas.ZoneSchema import SourceZoneSchema, ZoneUpdate, ZoneCreate, ZoneDelete
from app.services.vcc_service import vcc_service
from app.services.zone_service import createZone, updateZoneById, getAllZones, getZoneById, deleteZoneById
import dotenv
from dotenv import load_dotenv

load_dotenv()
logger = get_logger("camera_ai_app")
ics_url = os.getenv("ICS_URL")
router = APIRouter()

@router.post("/create-zone", status_code=200)
async def create_zone(body: ZoneCreate):
    """
    Example:
    {
        "zone_id": "1.1"
    }
    """
    
    result = await createZone(body.model_dump())
    
    return result

@router.get("/get-all-zones", status_code=200)
async def get_all_zones():
    result = await getAllZones()
    return result

@router.get("/get-zone-by-id")
async def get_zone_by_id(zone_id: str):
    result = await getZoneById(zone_id)
    return result

@router.patch("/update-zone-by-id")
async def update_zone_by_id(body: ZoneUpdate):
    """
    Example: 
    {
        "zone_id": "69",
    }
    """
    updated_data = body.model_dump(exclude_unset=True)
    zone_id= updated_data.pop("zone_id")
    
    if not updated_data:
        return {"message": "The field is empty."}
    
    try:
        result = await updateZoneById(zone_id, updated_data)
        return result
        
    except Exception as e:
        return {"message": str(e)}

@router.delete("/delete-zone-by-id")
async def delete_zone_by_id(body: ZoneDelete):
    """
    Example:
    {
        "zone_id": 5,
        "is_active": False,
        "is_deleted": True
    }
    """
    try:
        result = await deleteZoneById(body.model_dump(exclude_unset=True))
        return result
    
    except Exception as e:
        return {"message": str(e)}
    