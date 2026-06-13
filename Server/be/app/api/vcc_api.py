from dataclasses import asdict
from typing import Any

from shared.logging import get_logger
from fastapi import APIRouter, HTTPException
import os
from app.services.vcc_logic import moveToPoint
from app.services.vcc_service import vcc_service
from app.schemas.move_to_point import MoveToPointSchema

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
