from dataclasses import asdict
from typing import Any

from shared.logging import get_logger
from fastapi import APIRouter, HTTPException
import os
from app.services.vcc_logic import moveToPoint, get_possible_targets, create_new_point, get_all_points, update_point_data  # example name
from schemas.TargetPointSchema import MoveToPointSchema, PossibleTargetsResponse, StartPointSchema, PointSchema, PointUpdateSchema
from schemas.ZoneSchema import BaseZoneSchema, ZoneUpdate
from app.services.vcc_service import vcc_service
from app.services.zone_service import createZone
import dotenv
from dotenv import load_dotenv

load_dotenv()
logger = get_logger("camera_ai_app")
ics_url = os.getenv("ICS_URL")
router = APIRouter()

@router.post("/find-nearest")
async def find_nearest_api(body: dict[str, Any]):
    """
    Test Dijkstra: tìm end gần start nhất trên graph_map.

    Body:
    {
        "start": "10001541",
        "ends": ["10001540", "10001542", "10002125"]
    }
    """
    start = body.get("start")
    ends = body.get("ends")
    if not start or not ends or not isinstance(ends, list):
        raise HTTPException(
            status_code=400,
            detail="Body cần có 'start' (str) và 'ends' (list[str])",
        )

    try:
        if not vcc_service.graph_map:
            await vcc_service.initialize_graph_map()

        if not vcc_service.graph_map:
            raise HTTPException(
                status_code=503,
                detail="graph_map chưa sẵn sàng — kiểm tra map trong collection maps",
            )

        result = vcc_service.find_nearest_endpoint(start, ends)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error find nearest endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/warehouse")
async def get_warehouse_api():
    """
    Lấy danh sách ô kho, sort theo row rồi column.

    Response: list[{ "_id", "row", "column", "node_id", "status", "metadata", ... }]
    """
    try:
        return await vcc_service.get_warehouse_data()
    except Exception as e:
        logger.error(f"Error getting warehouse data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/move-to-point")
async def create_task(body: MoveToPointSchema):
    """
    Example Payload:
    {
        "start_point": 40000352,
        "target_point": 40000368,
        "move_mode": "rack_supply",
    }
    """
    try:
        return await moveToPoint(
            body.start_point,
            body.target_point,
            body.move_mode
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating point status: {str(e)}")
        raise HTTPException(status_code=500, detail="Server???")

@router.post("/create-point")
async def create_point(body: PointSchema):
    """
    Example:
    {
        "point": 1092303,
        "zone": "1.2"
    }
    """
    new_point=body.point
    zone= body.zone

    try:
        result = await create_new_point(new_point, zone)
        return result
    except Exception as e:
        return {"code": 500, "details": e}
    
@router.get("/get-all-points")
async def get_points():
    return await get_all_points()

@router.put("/point/{point_id}")
async def update_point(point_id: int, body: PointUpdateSchema):
    """Example:
    {
        "status": "shelf"
    }
    """
    updated_data = body.model_dump(exclude_unset=True)

    if not updated_data:
        return HTTPException(status_code=400, detail="No field is filled in.")
    
    try:
        result = await update_point_data(point_id, updated_data)
        # If the service layer returns an error (like point not found), raise a 404
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
            
        return result
        
    except HTTPException:
        raise 
    except Exception as e:
        return {"error": f"str{e}"}


@router.post("/possible-targets")
async def return_possible_targets(body: StartPointSchema):
    """
    Example Payload:
    {
        "start_point": 10003324,
        "move_mode": "to_rack" 
    }
    """
    try:
        result = await get_possible_targets(body.start_point, body.move_mode)
        
        if "error" in result:
            logger.error(f"Error fetching targets: {result['error']}")
            raise HTTPException(status_code=500, detail=result["error"])
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error calculating possible targets")
        raise HTTPException(status_code=500, detail="Server error processing targets")
