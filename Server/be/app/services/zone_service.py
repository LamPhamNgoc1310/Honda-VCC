from shared.logging import get_logger
from app.core.config import settings
import time
import uuid
from fastapi import HTTPException
import os
import pymongo
from pymongo import AsyncMongoClient
from dotenv import load_dotenv
from datetime import datetime, timezone
from schemas.ZoneSchema import BaseZoneSchema

load_dotenv()

logger = get_logger("camera_ai_app")
ics_url = f"http://192.168.1.100:7000"
client = AsyncMongoClient(os.getenv("MONGO_URL"))
db = client.get_database("test_caller")
zones_collection = db.get_collection("zones")
routing_rules = db.get_collection("routing_rules")

async def createZone(body: dict)->dict:
    now = datetime.now(timezone.utc)
    current_user = "admin_user"
    new_document = {
        "zone_id": body["zone_id"],
        "description": body["description"],
        "is_active": True,
        "is_deleted": False,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": current_user,
        "updatedBy": current_user
    }
    
    existing_zone= await zones_collection.find_one({"zone_id": body["zone_id"]})
    
    try:
        if not existing_zone:
            await zones_collection.insert_one(new_document)
            new_document.pop("_id", None)
            return {"message": "Okay", "details": f"A zone is created: {new_document}" }
    except Exception as e:
        return {"error": str(e)}
    
async def getAllZones():
    zone_list = await zones_collection.find({}, {"_id": 0}).to_list(length=None)
    return zone_list

async def getZoneById(zone_id: str):
    zone = await zones_collection.find_one({"zone_id": zone_id}, {"_id": 0})
    if not zone:
        return {"message": f"Zone {zone_id} does not exist."}
    return zone

async def updateZoneById(zone_id:str, updated_data: dict):
    now = datetime.now(timezone.utc)
    current_user = "admin_user"
    
    updated_data["updatedAt"] = now
    updated_data["updatedBy"] = current_user
    
    try:
        result = await zones_collection.update_one(
            {"zone_id": zone_id}, 
            {"$set": updated_data})
        
        if result.matched_count == 0:
            return {"message": "No zone matching the id {zone_id}"}
        
        return {"message": "Zone is updated {result}"}
        
    except Exception as e:
        return {"error": str(e)}
    
async def deleteZoneById(zone_id:str, updated_data: dict):
    now = datetime.now(timezone.utc)
    current_user = "admin_user"
    
    try:
        result = await zones_collection.update_one(
            {"zone_id": zone_id},
            {"$set": updated_data}
        )
        
        if result.matched_count == 0:
            return {"message": "No zone matching the id {zone_id}"}        
        return {"message": "Zone {zone_id} is successfully deleted."}
    
    except Exception as e:
        return {"error": str(e)}