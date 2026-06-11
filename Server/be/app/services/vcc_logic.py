from shared.logging import get_logger
from app.core.config import settings
import time
import uuid
from fastapi import HTTPException

logger = get_logger("logic_service")
ics_url = f"http://192.168.1.100:7000"

from datetime import datetime, timezone

async def get_possible_targets(start_point: int) -> dict:
    # Phase 1: Mocking the data with the new common fields and status
    mock_response = {
        "start_point": start_point,
        "time": datetime.now(timezone.utc),
        "possible_targets": [
            {
                "zone": 1,
                "points": [
                    {
                        "point_id": 10001234,
                        "node_name": "Rack-A1",
                        "status": "empty",
                        "node_type": "storage",
                        "distance": 234.0
                    },
                    {
                        "point_id": 10005678,
                        "node_name": "Rack-A2",
                        "status": "empty",  
                        "node_type": "storage",
                        "distance": 345.5
                    }
                ]
            },
            {
                "zone": 2,
                "points": [
                    {
                        "point_id": 10009999,
                        "node_name": "Supply-B1",
                        "status": "shelf",
                        "node_type": "supply",
                        "distance": 500.0
                    }
                ]
            }
        ]
    }
    
    return mock_response

async def add_task(payload):
    try:    
        print("This line for add_task")
        # async with httpx.AsyncClient(timeout=5) as client:
        #     response = await client.post(f"{ics_url}/ics/taskOrder/addTask", json=payload)
        # logger.info(f"ICS API response: {response.json()}")

        logger.info(f"Payload ICS mock: {payload}")
        print(f"[VCC mock ICS] {payload}")
        return {"message": "successfully sent task to ICS mock", "payload": payload }
    except Exception as e:
        logger.error(f"Error calling process caller: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def moveToPoint(
    start_point: int,
    target_point: int,
    move_mode: str="rack_supply"
) -> dict:
    orderId = f"move-{time.strftime('%H%M%S-%d%m%Y')}-{str(uuid.uuid4())[:4]}-from{start_point}-{target_point}"
    payload = {
        "moveMode": move_mode,
        "fromSystem": "Thadosoft",
        "orderId": orderId,
        "taskOrderDetail": [{"taskPath": f"{start_point}, {target_point}"}], 
    }
    await add_task(payload)
    return {
        "success": True,
        "message": "sent task to ics",
        "order_id": orderId,
        "start_point": start_point,
        "target_point": target_point,
        "move_mode": move_mode,
    }