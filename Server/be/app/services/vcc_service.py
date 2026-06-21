from dataclasses import dataclass
from datetime import datetime, timezone
from shared.logging import get_logger
from app.core.database import get_collection
import asyncio
from typing import Optional
import contextlib
import heapq
import math
import time
from collections import defaultdict

logger = get_logger("camera_ai_app")

GRAPH_MAP_AREA_ID = 1


def path_length_mm(path: list) -> float:
    """Tổng độ dài polyline (mm) từ danh sách điểm [[x, y], ...]."""
    return sum(
        math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
        for i in range(1, len(path))
    )


def edge_weight_mm(line: dict, node_coords: dict[str, tuple[int, int]]) -> int:
    """Trọng số cạnh (mm, int): ưu tiên path polyline, fallback Euclid giữa 2 node."""
    path = line.get("path") or []
    if len(path) >= 2:
        return round(path_length_mm(path))

    start = str(line.get("startNode", ""))
    end = str(line.get("endNode", ""))
    if start in node_coords and end in node_coords:
        x1, y1 = node_coords[start]
        x2, y2 = node_coords[end]
        return round(math.hypot(x2 - x1, y2 - y1))
    return 0


def _add_edge(graph: defaultdict, start: str, end: str, weight: int) -> None:
    """Thêm cạnh có hướng; nếu trùng start→end thì giữ weight nhỏ nhất."""
    neighbors = graph[start]
    for i, (neighbor, w) in enumerate(neighbors):
        if neighbor == end:
            if weight < w:
                neighbors[i] = (end, weight)
            return
    neighbors.append((end, weight))


@dataclass
class PathResult:
    node: str
    distance_mm: Optional[int]
    path: list[str]
    reachable: bool


@dataclass
class NearestTargetResult:
    nearest: Optional[PathResult]
    results: list[PathResult]


def _reconstruct_path(prev: dict[str, Optional[str]], target: str) -> list[str]:
    """Đi ngược prev từ target về start, trả về path [start, ..., target]."""
    if target not in prev:
        return []
    path: list[str] = []
    current: Optional[str] = target
    while current is not None:
        path.append(current)
        current = prev.get(current)
    path.reverse()
    return path


def _pick_nearest(results: list[PathResult]) -> Optional[PathResult]:
    """Chọn end reachable có distance nhỏ nhất; hòa thì ưu tiên thứ tự trong results."""
    reachable = [r for r in results if r.reachable and r.distance_mm is not None]
    if not reachable:
        return None
    return min(reachable, key=lambda r: r.distance_mm)


def dijkstra_to_targets(
    graph: dict[str, list[tuple[str, int]]],
    start: str,
    ends: list[str],
) -> NearestTargetResult:
    """
    Dijkstra một lần từ start; early stop khi đã settle tất cả end reachable.
    Trả về path + distance_mm cho từng end và điểm gần nhất.
    """
    start = str(start).strip()
    targets = list(dict.fromkeys(str(e).strip() for e in ends if str(e).strip()))

    if not targets:
        return NearestTargetResult(nearest=None, results=[])

    if start not in graph:
        logger.error(f"[Dijkstra] start node '{start}' not in graph_map")
        return NearestTargetResult(nearest=None, results=[])

    dist: dict[str, int] = {start: 0}
    prev: dict[str, Optional[str]] = {start: None}
    heap: list[tuple[int, str]] = [(0, start)]
    pending = {t for t in targets if t in graph and t != start}
    found: dict[str, int] = {}

    if start in targets:
        found[start] = 0

    while heap and pending:
        d, u = heapq.heappop(heap)
        if d != dist.get(u):
            continue
        if u in pending:
            found[u] = d
            pending.discard(u)
            if not pending:
                break
        for v, w in graph.get(u, []):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))

    results: list[PathResult] = []
    for end in targets:
        if end not in graph:
            results.append(PathResult(node=end, distance_mm=None, path=[], reachable=False))
        elif end in found:
            results.append(PathResult(
                node=end,
                distance_mm=found[end],
                path=_reconstruct_path(prev, end),
                reachable=True,
            ))
        else:
            results.append(PathResult(node=end, distance_mm=None, path=[], reachable=False))

    return NearestTargetResult(nearest=_pick_nearest(results), results=results)


DEFAULT_WAREHOUSE = [
    {"row": 1, "column": 1, "node_id": 40000368, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 1, "column": 2, "node_id": 40000369, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 1, "column": 3, "node_id": 40000370, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 1, "column": 4, "node_id": 40000371, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 1, "column": 5, "node_id": 40000367, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 2, "column": 1, "node_id": 40000383, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 2, "column": 2, "node_id": 40000384, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 2, "column": 3, "node_id": 40000385, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 2, "column": 4, "node_id": 40000376, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 2, "column": 5, "node_id": 40000377, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 1, "node_id": 40000154, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 2, "node_id": 40000156, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 3, "node_id": 40000158, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 4, "node_id": 40000159, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 5, "node_id": 40000160, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 5, "node_id": 40000208, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 1, "node_id": 40000141, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 2, "node_id": 40000146, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 3, "node_id": 40000147, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 4, "node_id": 40000148, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 3, "column": 5, "node_id": 40000138, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 3, "column": 5, "node_id": 40000137, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 4, "column": 1, "node_id": 40005576, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 4, "column": 2, "node_id": 40005575, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 4, "column": 3, "node_id": 40005574, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 4, "column": 4, "node_id": 40005572, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 4, "column": 1, "node_id": 40001423, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 4, "column": 2, "node_id": 40000126, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)}, 
    {"row": 4, "column": 3, "node_id": 40000127, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 4, "column": 4, "node_id": 40000128, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
    {"row": 4, "column": 5, "node_id": 40000130, "status": "shelf", "metadata": {}, "updated_at": datetime.now(timezone.utc)},
]

class vcc_service:
    def __init__(self) -> None:
        self._consumer_task: Optional[asyncio.Task] = None
        self.index_warehouse_code = defaultdict(list)
        self.index_warehouse_full = defaultdict(dict)
        self.graph_map: dict[str, list[tuple[str, int]]] = defaultdict(list)
        self.node_coords: dict[str, tuple[int, int]] = {}
        self.graph_map_area_id: Optional[int] = None

    async def start(self) -> None:
        await self.initialize_warehouse()
        await self.initialize_index_warehouse()
        await self.initialize_graph_map()
        if self._consumer_task is None:
            self._consumer_task = asyncio.create_task(self._consumer_loop())

    async def stop(self) -> None:
        if self._consumer_task:
            self._consumer_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._consumer_task
            self._consumer_task = None

    async def _consumer_loop(self) -> None:
        while True:
            try:                         
                await asyncio.sleep(5) 
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in manager loop: {e}")
                await asyncio.sleep(1)

    async def initialize_graph_map(self, area_id: int = GRAPH_MAP_AREA_ID) -> None:
        map_collection = get_collection("maps")
        doc = await map_collection.find_one({"area_id": int(area_id)})

        if not doc or not doc.get("data"):
            logger.error(f"Map not found for area_id={area_id}; graph_map cleared")
            self.graph_map = defaultdict(list)
            self.node_coords = {}
            self.graph_map_area_id = None
            return

        data = doc["data"]
        node_arr = data.get("nodeArr") or []
        line_arr = data.get("lineArr") or []

        node_coords: dict[str, tuple[int, int]] = {}
        for node in node_arr:
            key = str(node.get("key")).strip()
            if not key:
                continue
            x, y = node.get("x"), node.get("y")
            if x is None or y is None:
                continue
            node_coords[key] = (int(x), int(y))

        graph: dict[str, list[tuple[str, int]]] = defaultdict(list)
        for key in node_coords:
            _ = graph[key]

        edge_count = 0
        for line in line_arr:
            start = str(line.get("startNode", "")).strip()
            end = str(line.get("endNode", "")).strip()
            if not start or not end:
                continue

            weight = edge_weight_mm(line, node_coords)
            if weight <= 0:
                logger.warning(f"Skip edge {start}->{end}: invalid weight")
                continue

            _ = graph[end]
            _add_edge(graph, start, end, weight)
            edge_count += 1

        self.graph_map = dict(graph)
        self.node_coords = node_coords
        self.graph_map_area_id = int(area_id)
        logger.info(
            f"Graph map initialized for area_id={area_id}: "
            f"{len(self.graph_map)} nodes, {edge_count} edges"
        )

    def find_nearest_endpoint(self, start: str, ends: list[str]) -> NearestTargetResult:
        """Tìm end gần start nhất trên graph_map; log path và chi phí từng end."""
        if not self.graph_map:
            logger.error("[Dijkstra] graph_map is empty; call initialize_graph_map first")
            return NearestTargetResult(nearest=None, results=[])

        start = str(start).strip()
        targets = list(dict.fromkeys(str(e).strip() for e in ends if str(e).strip()))
        logger.info(f"[Dijkstra] start={start}, candidates={len(targets)}")

        result = dijkstra_to_targets(self.graph_map, start, targets)

        # for r in result.results:
        #     if r.reachable and r.distance_mm is not None:
        #         path_str = " -> ".join(r.path)
        #         logger.info(f"  -> {r.node}: {r.distance_mm} mm | path: {path_str}")
        #     else:
        #         logger.info(f"  -> {r.node}: unreachable")

        if result.nearest:
            logger.info(
                f"[Dijkstra] nearest={result.nearest.node} ({result.nearest.distance_mm} mm)"
            )
        else:
            logger.info("[Dijkstra] nearest=None (no reachable endpoint)")
        nearest_node = result.nearest.node if result.nearest else None
        return nearest_node


    async def initialize_index_warehouse(self):
        warehouse_collection = get_collection("warehouse")
        cursor = warehouse_collection.find({})
        warehouses = await cursor.to_list(length=None)
        for warehouse in warehouses:
            self.index_warehouse_full[warehouse["row"]][warehouse["column"]] = warehouse
            if warehouse["status"] == "shelf":
                code = warehouse["metadata"].get("code")
                self.index_warehouse_code[code].append(warehouse)
                
        logger.info(f"Initialized {len(self.index_warehouse_code)} warehouses with code and {len(self.index_warehouse_full)} empty warehouses")

    async def initialize_warehouse(self):
        warehouse_collection = get_collection("warehouse")
        
        for warehouse in DEFAULT_WAREHOUSE:
            existing = await warehouse_collection.find_one({"row": warehouse["row"], "column": warehouse['column']})
            if not existing:
                data = {
                    **warehouse,
                    "created_at": datetime.utcnow(),
                }
                await warehouse_collection.insert_one(data)
                logger.info(f"Created row {warehouse['row']} column {warehouse['column']} warehouse")

    async def update_status(self, point_id, new_status, metadata):
        warehouse_collection = get_collection("warehouse")
        now = datetime.now(timezone.utc)

        try:
            query = {
                "node_id": int(point_id)
            }

            if metadata:  
                metadata_data = {
                    "metadata": metadata,
                }
            else:
                metadata_data = {}

            update_data = {
                "$set": {
                    "status": str(new_status),
                    **metadata_data,
                    "updated_at": now
                }
            }
            result = await warehouse_collection.update_one(query, update_data)

            if result.matched_count > 0:
                if result.modified_count > 0:
                    logger.info(f"✅ Update Warehouse Row {row} - Column {column} -> {new_status}")
                else:
                    logger.info(f"ℹ️ Warehouse Row {row} - Column {column} is currently {new_status}.")
                return True
            
            logger.error(f"❌ Cannot find any: Warehouse Row {row}, Column {column}")
            return False

        except ValueError:
            logger.error("❌ Error: Row and Column must be int!")
            return False

    async def get_optimize_inbound(self, metadata):
        warehouse_collection = get_collection("warehouse")
        code = metadata.get("code")

        #TH1: Found the resemble code
        if code in self.index_warehouse_code:
            empty_list = [
                str(self.index_warehouse_full[row][col]["node_id"])
                for row in self.index_warehouse_full
                for col in self.index_warehouse_full[row]
                if self.index_warehouse_full[row][col].get("status") == "empty"
            ]

            if len(empty_list) == 0:
                logger.info(f"Don't have any empty warehouse")
                return {"code": 200, "message": "Don't have any empty warehouse"}

            warehouse = self.index_warehouse_code[code]
            sort_list = sorted(warehouse, key=lambda s: (s["row"], s["column"]))
            edge = sort_list[0]["node_id"]
            target = self.find_nearest_endpoint(edge, empty_list)

            if target:
                logger.info(f"Found the nearest endpoint {target}")
                return {"code": 200, "message": "Found the nearest endpoint", "data": target}

        #TH2: Found optimize in warehouse
        else:
            logger.info(f"Don't have resemble product with code {code}")
            empty_list = [
                self.index_warehouse_full[row][col]
                for row in self.index_warehouse_full
                for col in self.index_warehouse_full[row]
                if self.index_warehouse_full[row][col].get("status") == "empty"
            ]
            if len(empty_list) == 0:
                logger.info(f"Don't have any empty warehouse")
                return {"code": 200, "message": "Don't have any empty warehouse"}

            empty_list.sort(key=lambda x: (x["row"], x["column"]))
            selected_index = []
            start = 0

            max_col_per_row = {
                row: max(self.index_warehouse_full[row].keys()) 
                for row in self.index_warehouse_full
            }

            #First optimize - empty in the front or rear of row with 3 beside empty
            for i, empty in enumerate(empty_list):
                row = empty["row"]
                col = empty["column"]
                if col == 1:  
                    if (i + 3 < len(empty_list) and
                        all(empty_list[i+k]["row"] == row and
                            empty_list[i+k]["column"] == col + k
                            for k in range(1, 4))):
                        return {"code": 200, "data": empty["node_id"]}
                elif col == max_col_per_row[row]:  
                    if (i >= 3 and
                        all(empty_list[i-k]["row"] == row and
                            empty_list[i-k]["column"] == col - k
                            for k in range(1, 4))):
                        return {"code": 200, "data": empty["node_id"]}
            
            #Second optimize - 3 left and right empty
            for end in range(1, len(empty_list)):
                cur = empty_list[end]
                prev = empty_list[end - 1]
                
                if prev["row"] != cur["row"] or cur["column"] - prev["column"] != 1:
                    start = end

                if end - start + 1 == 7:
                    return {"code": 200, "data": empty_list[start + 3]["node_id"]}

            #Final only found empty
            return {"code": 200, "data": empty_list[-1]["node_id"]}

    async def get_optimize_outbound(self, metadata):
        warehouse_collection = get_collection("warehouse")
        code = metadata.get("code")

        if not code in self.index_warehouse_code:
            logger.info(f"Don't have any product with code {code}")
            return {"code": 200, "message": "Don't have any product with code"}
        
        sort_index_code = sorted(self.index_warehouse_code[code], key=lambda s: s["updated_at"])
        quantity = metadata.get("quantity")
        selected_index = []
        surplus = {}

        for i in sort_index_code:
            quantity -= i.get("quantity")
            selected_index.append(i)
            if quantity == 0:
                return {"code": 200, "message": "Found the product", "data": selected_index}
            elif quantity < 0:
                surplus = index[i]
                selected_index[i]["quantity"] += quantity
                surplus["quantity"] = -quantity
                return {"code": 200, "message": "Found the product", "data": selected_index, "surplus": surplus}
            else:
                continue

        logger.info(f"Not enough product for code {code}")
        return {"code": 200, "message": "Not enough product for code"}
                

    async def get_warehouse_data(self) -> list[dict]:
        warehouse_collection = get_collection("warehouse")
        cursor = warehouse_collection.find({}).sort([("row", 1), ("column", 1)])
        warehouses = await cursor.to_list(length=None)

        for item in warehouses:
            item["_id"] = str(item["_id"])
            if item.get("created_at"):
                item["created_at"] = item["created_at"].isoformat()
            if item.get("updated_at"):
                item["updated_at"] = item["updated_at"].isoformat()

        return warehouses

vcc_service = vcc_service()
