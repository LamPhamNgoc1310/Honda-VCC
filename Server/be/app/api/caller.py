from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from app.services.node_service import process_caller, process_caller_WE
from app.services.monitor_service import increment_produced_quantity_by_node_end
from app.api.agv_websocket import broadcast_monitor_data
from app.schemas.node import ProcessCaller
import httpx,requests
from shared.logging import get_logger
from app.core.config import settings
import os

logger = get_logger("camera_ai_app")
ics_url = f"http://192.168.1.100:7000"

router = APIRouter()

@router.post("/process-caller")
async def manual_caller(node: ProcessCaller, priority: Optional[int] = Query(None, description="Priority of the process caller")):
    payload = await process_caller(node, priority)
    try:
        print("this debug line exists")
        response = requests.post(
            f"{ics_url}/ics/taskOrder/addTask",
            json=payload,
            timeout=5
        )
        payload.orderId
        logger.info(f"{response}")
        return {"status": "success", "payload": payload}
    except Exception as e:
        logger.error(f"Error calling process caller: {str(e)}")
        print("This is ics_url: ",ics_url)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/cancel-task")
async def manual_cancel(order_id: str, dest_position: Optional[int] = Query(None, description="Destination of the current task")):
    payload = [{"orderId": order_id}]
    if dest_position:
        payload[0]["destPosition"] = dest_position
    try:
        response = requests.post(
            f"{ics_url}/ics/out/task/cancelTask",
            json=payload,
            timeout=5
        )
        return {"status": "success", "payload": payload}
    except Exception as e:  
        logger.error(f"Error calling process caller: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")




