"""
Test Dijkstra find_nearest_endpoint trên graph_map (area_id=1).

Chạy từ Server/be:
  python test/test_dijkstra_nearest.py
"""

import asyncio
import os
import sys

BE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(BE_DIR, "app")
if BE_DIR not in sys.path:
    sys.path.insert(0, BE_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(APP_DIR, ".env"))
load_dotenv(os.path.join(BE_DIR, ".env"))

from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo
from app.services.vcc_service import vcc_service, GRAPH_MAP_AREA_ID


async def main() -> None:
    await connect_to_mongo(settings.mongo_url, settings.mongo_db)
    try:
        await vcc_service.initialize_graph_map(area_id=GRAPH_MAP_AREA_ID)

        start = "10001541"
        ends = ["10001540", "10001542", "10002125"]

        result = vcc_service.find_nearest_endpoint(start, ends)

        assert result.nearest is not None, "Expected a nearest endpoint"
        assert result.nearest.node == "10001540", (
            f"Expected nearest 10001540, got {result.nearest.node}"
        )
        assert result.nearest.distance_mm == 770, (
            f"Expected 770 mm, got {result.nearest.distance_mm}"
        )
        assert result.nearest.path == [start, "10001540"], (
            f"Unexpected path: {result.nearest.path}"
        )

        print("PASS: nearest endpoint verified")
        print(f"  nearest : {result.nearest.node} @ {result.nearest.distance_mm} mm")
        print(f"  path    : {' -> '.join(result.nearest.path)}")
        print(f"  all ends: {len(result.results)} results")
        for r in result.results:
            status = f"{r.distance_mm} mm" if r.reachable else "unreachable"
            print(f"    {r.node}: {status}")

        # Unreachable node test
        bad = vcc_service.find_nearest_endpoint(start, ["99999999", "10001540"])
        assert bad.nearest is not None and bad.nearest.node == "10001540"
        unreachable = next(r for r in bad.results if r.node == "99999999")
        assert not unreachable.reachable
        print("PASS: unreachable endpoint handled")

    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
