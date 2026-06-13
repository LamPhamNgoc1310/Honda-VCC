# WHAT TO DO IN THIS FILE:
# receives status from rcs (mock)
# update point status with vcc_api
# add locked and unlocked status to prevent spamming, repeatedly calling until task ends/cancelled
# add a lock in pairs when the task between them is on-going

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

@router.get("/move-to-point", status_code=200)
async def moveToPointCheck():
    return {"message": "Okay"}
    