"""
Kiểm tra graph_map sau khi initialize_graph_map (area_id mặc định = 1).

Chạy từ Server/be:
  python test/verify_graph_map.py
  python test/verify_graph_map.py --node 10001541
"""

import argparse
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


def edge_weight(graph: dict, start: str, end: str) -> int | None:
    for neighbor, weight in graph.get(start, []):
        if neighbor == end:
            return weight
    return None


async def main() -> None:
    parser = argparse.ArgumentParser(description="Verify VCC graph_map from MongoDB map")
    parser.add_argument("--area_id", "-a", type=int, default=GRAPH_MAP_AREA_ID)
    parser.add_argument("--node", "-n", type=str, default="10001541", help="Node key để in neighbors")
    args = parser.parse_args()

    await connect_to_mongo(settings.mongo_url, settings.mongo_db)
    try:
        await vcc_service.initialize_graph_map(area_id=args.area_id)
        graph = vcc_service.graph_map

        total_edges = sum(len(neighbors) for neighbors in graph.values())
        print(f"area_id       : {vcc_service.graph_map_area_id}")
        print(f"nodes         : {len(graph)}")
        print(f"directed edges: {total_edges}")

        sample_node = args.node
        if sample_node in graph:
            neighbors = graph[sample_node]
            print(f"\nNeighbors of {sample_node} ({len(neighbors)}):")
            for end, w in neighbors[:10]:
                print(f"  -> {end}  weight={w} mm")
            if len(neighbors) > 10:
                print(f"  ... và {len(neighbors) - 10} cạnh khác")
        else:
            print(f"\n[!] Node {sample_node} không có trong graph")

        w = edge_weight(graph, "10001541", "10001540")
        if w is not None:
            print(f"\nEdge 10001541 -> 10001540: {w} mm (kỳ vọng ~770)")
        else:
            print("\n[!] Không tìm thấy cạnh 10001541 -> 10001540")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
