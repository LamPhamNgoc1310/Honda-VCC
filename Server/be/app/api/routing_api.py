from fastapi import APIRouter, HTTPException
from schemas.RoutingSchema import PriorityRuleCreate, PriorityRuleUpdate, PriorityTarget
from services.routing_service import createZonePriorityRule, getAllPriorityRules, getZonePriorityRuleById, updateZonePriorityRuleById
from dotenv import load_dotenv
import os
from shared.logging import get_logger

load_dotenv()
logger = get_logger("camera_ai_app")
ics_url = os.getenv("ICS_URL")
router = APIRouter()

router = APIRouter()

@router.post("/create-zone-priority-rule")
async def create_zone_priority_rule(body: PriorityRuleCreate):
    """
    Example:
    {
      "rule_id": "rule_1.1_to_rack",
      "source_zone": "1.1",
      "move_mode": "to_rack",
      "priorities": [
        {"target_zone": "1.2", "weight": 1},
        {"target_zone": "4", "weight": 2}
      ]
    }
    """
    result = await createZonePriorityRule(body.model_dump())
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.get("/get-all-priority-rules")
async def get_all_priority_routes():
    return await getAllPriorityRules()

@router.get("/get-priority-rule-by-id")
async def get_zone_priority_route_by_id(rule_id: str):
    return await getZonePriorityRuleById(rule_id)

@router.patch("/update-zone-priority-rule-by-id")
async def update_zone_priority_route_by_id(body: PriorityRuleUpdate):    
    return await updateZonePriorityRuleById(body.model_dump())
    