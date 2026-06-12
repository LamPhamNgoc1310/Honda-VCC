# NOT DONE, THIS IS JUST A TEMPLATE.
# button --> send api to rcs --> rcs receives task --> rcs call amr to start point  
# --> amr goes to start point to take item --> amr return pick-up status --> slot status: empty --> delivering
# --> amr done task at endpoint --> update end status as: full
# need to lock pair in the database until task is done.

from shared.logging import get_logger
from fastapi import APIRouter, Request, HTTPException, Query, Body
import os
from app.services.vcc_logic import moveToPoint, get_possible_targets, create_new_point, get_all_points, update_point_data  # example name
from schemas.TargetPointSchema import MoveToPointSchema, PossibleTargetsResponse, StartPointSchema, PointSchema, PointUpdateSchema
import dotenv
from dotenv import load_dotenv

load_dotenv()
logger = get_logger("camera_ai_app")
ics_url = os.getenv("ICS_URL")


router = APIRouter()


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

@router.post("/point")
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
    
@router.get("/point")
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