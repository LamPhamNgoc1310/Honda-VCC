# NOT DONE, THIS IS JUST A TEMPLATE.
# button --> send api to rcs --> rcs receives task --> rcs call amr to start point  
# --> amr goes to start point to take item --> amr return pick-up status --> slot status: empty --> delivering
# --> amr done task at endpoint --> update end status as: full
# need to lock pair in the database until task is done.

from shared.logging import get_logger
from fastapi import APIRouter, Request, HTTPException, Query, Body
import os
from app.services.vcc_logic import moveToPoint  # example name
from app.schemas.move_to_point import MoveToPointSchema
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