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

load_dotenv()
logger = get_logger("camera_ai_app")
ics_url = f"http://192.168.1.100:7000"
client = AsyncMongoClient(os.getenv("MONGO_URL"))
db = client.get_database("test_caller")
routing_rules_collection = db.get_collection("routing_rules")

async def createZonePriorityRule(body:dict):
    now = datetime.now(timezone.utc)
    current_user = "admin"
    
    body["createdAt"]=now
    body["updatedAt"]=now
    body["createdBy"]=current_user
    body["updatedBy"]=current_user

    try:
        existing = await routing_rules_collection.find_one({"rule_id": body["rule_id"]})
        if existing:
            return {f'Rule {body["rule_id"]} already exists.'}
        
        conflict_rule= await routing_rules_collection.find_one(
            {"source_zone": body["source_zone"]},
            {"move_mode": body["move_mode"]}
            )
        if conflict_rule:
            return {f'The rule for {body["source_zone"]} with move mode {body["move_mode"]} already exists.'}
        await routing_rules_collection.insert_one(body)
        body.pop("_id")
        return body
    except Exception as e:
        return {"error": e}
    
async def getAllPriorityRules():
    try:
        result = await routing_rules_collection.find({}, {"_id": 0}).to_list(length=None)
        return result
    except Exception as e:
        return e
    
async def getZonePriorityRuleById(rule_id: str):
    result = await routing_rules_collection.find_one({"rule_id": rule_id})
    if not result:
        return {f"The rule id {rule_id} does not exist."}
    
async def updateZonePriorityRuleById(body: dict):
    rule_id = body.pop("rule_id", None)
    
    now=datetime.now(timezone.utc)
    current_user="admin"
    
    body["updatedAt"]=now
    body["updatedBy"]=current_user
    
    existing= await routing_rules_collection.find_one({"rule_id": rule_id})
    if not existing:
        return {f'The rule {rule_id} does not exist.'}
    try:
        await routing_rules_collection.update_one({"rule_id": rule_id}, {"$set": body})
        return {"message": f'Rule id "{rule_id}" updated successfully.'}

    except Exception as e:
        return {"error": e}
    
    
    
    
    