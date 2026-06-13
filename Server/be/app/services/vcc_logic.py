from shared.logging import get_logger
from app.core.config import settings
import time
import uuid
from fastapi import HTTPException
import os
import pymongo
from pymongo import AsyncMongoClient
from dotenv import load_dotenv

load_dotenv()

logger = get_logger("camera_ai_app")
ics_url = f"http://192.168.1.100:7000"
client = AsyncMongoClient(os.getenv("MONGO_URL"))
db = client.get_database("test_caller")
points_collection= db.get_collection("points")
maps_collection = db.get_collection("maps")


from datetime import datetime, timezone

async def get_possible_targets(start_point: int, move_mode: str) -> dict:
    zone_priority = ["1.2", "1.1", "2.1", "1.5"] 

    try:
        cursor = points_collection.find({"status": "empty"}, {"_id": 0})
        
        empty_points = []
        async for point in cursor:
            empty_points.append(point)

        if not empty_points:
            return {"message": "No empty points available", "data": []}

        empty_points.sort(
            key=lambda p: zone_priority.index(p["zone"]) if p["zone"] in zone_priority else 999
        )
        return {
            "message": "Possible targets found", 
            "total": len(empty_points), 
            "data": empty_points
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}

#12/06/2026
async def create_new_point(new_point: int, zone: str) -> dict:
    now = datetime.now(timezone.utc)
    current_user = "admin_user"

    new_document = {
        "point": new_point,
        "zone": zone,
        "status": "empty",
        "createdAt": now,
        "updatedAt": now,
        "createdBy": current_user,
        "updatedBy": current_user
    }

    existing_point = await points_collection.find_one({"point": new_point})

    try:
        if not existing_point:
            await points_collection.insert_one(new_document)
            new_document.pop("_id", None)
            return {"message": f"Point {new_point} created successfully", "data": new_document}
        
        else:
            return {"message": f"Point {new_point} already exists."}
    except Exception as e:
        return {"error": {str(e)}}
    
async def get_all_points():
    try:
        all_points = points_collection.find({}, {"_id": 0})
        points_list = []
        async for point in all_points:
            points_list.append(point)

        return {"message": "Success", "total": len(points_list), "data": points_list}
    except Exception as e:
        return {"error": f"{str(e)}"}
    
async def update_point_data(point: int, updated_fields: dict)->dict:
    now = datetime.now(timezone.utc)
    current_user="admin_user"

    updated_fields["updatedAt"] = now
    updated_fields["updatedBy"] = current_user

    try:
        result = await points_collection.update_one(
            {"point": point},
            {"$set": updated_fields}
        )

        if result.matched_count == 0:
            return {"error": f"Error, point {point} doesn't not exist"}
        
        return {"message": f"Point {point} updated successfully."}
    except Exception as e:
        return {"error": f"{e}"}
    return

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






# mock_response = {
#         "start_point": start_point,
#         "time": datetime.now(timezone.utc),
#         "possible_targets": [
#             {
#                 "zone": 1,
#                 "points": [
#                     {
#                         "point_id": 10001234,
#                         "node_name": "Rack-A1",
#                         "status": "empty",
#                         "node_type": "storage",
#                         "distance": 234.0
#                     },
#                     {
#                         "point_id": 10005678,
#                         "node_name": "Rack-A2",
#                         "status": "empty",  
#                         "node_type": "storage",
#                         "distance": 345.5
#                     }
#                 ]
#             },
#             {
#                 "zone": 2,
#                 "points": [
#                     {
#                         "point_id": 10009999,
#                         "node_name": "Supply-B1",
#                         "status": "shelf",
#                         "node_type": "supply",
#                         "distance": 500.0
#                     }
#                 ]
#             }
#         ]
#     }