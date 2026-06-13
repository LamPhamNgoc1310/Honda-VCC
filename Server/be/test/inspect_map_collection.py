"""
Script kiểm tra cấu trúc collection `maps` trên MongoDB.

Chạy từ thư mục Server/be:
  python -m test.inspect_map_collection
  python -m test.inspect_map_collection --area_id 1
  python -m test.inspect_map_collection --sample-nodes 3 --sample-lines 2
"""

import argparse
import asyncio
import json
import os
import sys
from collections import Counter
from datetime import datetime
from typing import Any

BE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(BE_DIR, "app")
if BE_DIR not in sys.path:
    sys.path.insert(0, BE_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(APP_DIR, ".env"))
load_dotenv(os.path.join(BE_DIR, ".env"))

from bson import ObjectId

from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo, get_collection

COLLECTION_NAME = "maps"

# Ý nghĩa các trường (theo codebase backend + frontend)
FIELD_MEANINGS = {
    "_id": "ObjectId MongoDB — định danh document map",
    "area_id": "ID khu vực (integer) — mỗi area chỉ có tối đa 1 map",
    "data": "Toàn bộ nội dung bản đồ AGV (JSON từ file compress.json sau khi import)",
    "created_at": "Thời điểm tạo bản ghi map",
    "updated_at": "Thời điểm cập nhật lần cuối",
    "nodeKeys": "Danh sách tên/key các trường trong mỗi phần tử nodeArr (định dạng gốc từ RCS)",
    "lineKeys": "Danh sách tên/key các trường trong mỗi phần tử lineArr",
    "nodeArr": "Danh sách điểm (node) trên bản đồ: vị trí, loại, mã QR/content, tên hiển thị",
    "lineArr": "Danh sách cạnh/đường nối giữa các node",
    "x": "Tọa độ X của node trên bản đồ",
    "y": "Tọa độ Y của node trên bản đồ",
    "type": "Loại node (điểm chờ, kệ, trạm sạc, ... — theo hệ RCS)",
    "content": "Mã định danh node (thường là QR code / node id từ RCS)",
    "key": "Khóa node dùng để khớp với lineArr.startNode / endNode (thường = content)",
    "name": "Tên hiển thị của node — backend dùng để map qr_code task → tên điểm",
    "isTurn": "Cho phép/quy tắc quay đầu tại node (0/1)",
    "shelfIsTurn": "Quy tắc quay kệ tại node (0/1)",
    "extraTypes": "Các loại phụ bổ sung cho node (mảng)",
    "startNode": "Key/content node bắt đầu của đoạn đường",
    "endNode": "Key/content node kết thúc của đoạn đường",
    "leftWidth": "Độ rộng làn trái của đường (mm hoặc đơn vị map)",
    "rightWidth": "Độ rộng làn phải của đường",
    "startExpandDistance": "Khoảng mở rộng tại điểm bắt đầu",
    "endExpandDistance": "Khoảng mở rộng tại điểm kết thúc",
    "path": "Điểm trung gian trên đường (polyline), nếu có",
    "width": "Chiều rộng canvas bản đồ (đơn vị map, mm)",
    "height": "Chiều cao canvas bản đồ (đơn vị map, mm)",
    "xAttrMin": "Offset tọa độ X tối thiểu — dùng khi render bản đồ",
    "yAttrMin": "Offset tọa độ Y tối thiểu — dùng khi render bản đồ",
    "allPath": "Danh sách toàn bộ đường đi (path segments) từ file RCS gốc",
    "chargeCoor": "Danh sách trạm sạc — mỗi phần tử [node_id, tọa độ/object]",
}


def json_default(obj: Any) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    return repr(obj)


def type_name(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return f"list[{len(value)}]"
    if isinstance(value, dict):
        return f"dict[{len(value)} keys]"
    if isinstance(value, ObjectId):
        return "ObjectId"
    if isinstance(value, datetime):
        return "datetime"
    return type(value).__name__


def collect_schema(value: Any, path: str = "", schema: dict | None = None) -> dict:
    """Thu thập cấu trúc lồng nhau: path -> {types, sample}."""
    if schema is None:
        schema = {}

    types = schema.setdefault(path or "(root)", {"types": Counter(), "sample": None})
    types["types"][type_name(value)] += 1
    if types["sample"] is None and value not in (None, [], {}):
        if isinstance(value, (str, int, float, bool)):
            types["sample"] = value
        elif isinstance(value, list) and value:
            types["sample"] = f"<{type_name(value[0])}>"
        elif isinstance(value, dict):
            types["sample"] = list(value.keys())[:8]

    if isinstance(value, dict):
        for key, child in value.items():
            collect_schema(child, f"{path}.{key}" if path else key, schema)
    elif isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, dict):
            for key, child in first.items():
                collect_schema(child, f"{path}[].{key}" if path else f"[].{key}", schema)
        else:
            collect_schema(first, f"{path}[]" if path else "[]", schema)

    return schema


def print_separator(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def print_field_meaning(field: str) -> None:
    meaning = FIELD_MEANINGS.get(field)
    if meaning:
        print(f"    → {meaning}")


def summarize_node_arr(node_arr: list) -> None:
    if not node_arr:
        print("  nodeArr: (rỗng)")
        return

    first = node_arr[0]
    print(f"  nodeArr: {len(node_arr)} phần tử")
    if isinstance(first, dict):
        print(f"    Định dạng: object — keys: {list(first.keys())}")
        type_counter = Counter(str(n.get("type")) for n in node_arr if isinstance(n, dict))
        print(f"    Phân bố type (top 10): {dict(type_counter.most_common(10))}")
    elif isinstance(first, list):
        print(f"    Định dạng: mảng lồng (chưa convert) — độ dài phần tử: {len(first)}")
    else:
        print(f"    Định dạng: {type_name(first)}")


def summarize_line_arr(line_arr: list) -> None:
    if not line_arr:
        print("  lineArr: (rỗng)")
        return

    first = line_arr[0]
    print(f"  lineArr: {len(line_arr)} phần tử")
    if isinstance(first, dict):
        print(f"    Định dạng: object — keys: {list(first.keys())}")
    elif isinstance(first, list):
        print(f"    Định dạng: mảng lồng (chưa convert) — độ dài phần tử: {len(first)}")
    else:
        print(f"    Định dạng: {type_name(first)}")


async def inspect_maps(area_id: int | None, sample_nodes: int, sample_lines: int) -> None:
    coll = get_collection(COLLECTION_NAME)

    total = await coll.count_documents({})
    print_separator("KẾT NỐI MONGODB")
    print(f"Database : {settings.mongo_db}")
    print(f"Collection: {COLLECTION_NAME}")
    print(f"Tổng số document: {total}")

    if total == 0:
        print("\n[!] Collection rỗng — chưa có map nào được lưu.")
        return

    query = {}
    if area_id is not None:
        query["area_id"] = area_id

    cursor = coll.find(query).sort("area_id", 1)
    docs = await cursor.to_list(length=None)

    if not docs:
        print(f"\n[!] Không tìm thấy map với area_id={area_id}")
        return

    print_separator("CẤU TRÚC DOCUMENT (cấp collection)")
    print("Mỗi document trong `maps` có dạng:")
    for field in ("_id", "area_id", "data", "created_at", "updated_at"):
        print(f"  - {field}")
        print_field_meaning(field)

    area_ids = [d.get("area_id") for d in docs]
    print(f"\nDanh sách area_id đang có map: {area_ids}")

    for doc in docs:
        aid = doc.get("area_id")
        print_separator(f"MAP area_id = {aid}")

        print("Trường gốc:")
        for key in ("_id", "area_id", "created_at", "updated_at"):
            if key in doc:
                print(f"  {key:12} : {json.dumps(doc[key], default=json_default)}")
                print_field_meaning(key)

        data = doc.get("data")
        if not isinstance(data, dict):
            print(f"\n  data: {type_name(data)} — không phải object JSON")
            continue

        print("\nTrường `data` (nội dung bản đồ):")
        for key in sorted(data.keys()):
            val = data[key]
            print(f"  {key:12} : {type_name(val)}")
            print_field_meaning(key)

        node_keys = data.get("nodeKeys")
        line_keys = data.get("lineKeys")
        if node_keys:
            print(f"\n  nodeKeys ({len(node_keys)}): {node_keys}")
        if line_keys:
            print(f"  lineKeys ({len(line_keys)}): {line_keys}")

        summarize_node_arr(data.get("nodeArr") or [])
        summarize_line_arr(data.get("lineArr") or [])

        node_arr = data.get("nodeArr") or []
        if node_arr and sample_nodes > 0:
            print(f"\n  Mẫu nodeArr (tối đa {sample_nodes}):")
            for i, node in enumerate(node_arr[:sample_nodes]):
                print(f"    [{i}] {json.dumps(node, ensure_ascii=False, default=json_default)}")

        line_arr = data.get("lineArr") or []
        if line_arr and sample_lines > 0:
            print(f"\n  Mẫu lineArr (tối đa {sample_lines}):")
            for i, line in enumerate(line_arr[:sample_lines]):
                print(f"    [{i}] {json.dumps(line, ensure_ascii=False, default=json_default)}")

        schema = collect_schema(data)
        extra_paths = sorted(p for p in schema if p not in ("", "nodeArr", "lineArr", "nodeKeys", "lineKeys"))
        if extra_paths:
            print("\n  Trường bổ sung trong `data`:")
            for path in extra_paths:
                info = schema[path]
                types = ", ".join(f"{t}×{c}" for t, c in info["types"].items())
                print(f"    {path:30} ({types})")

    # Schema tổng hợp từ tất cả map được quét
    print_separator("SCHEMA TỔNG HỢP TRƯỜNG `data`")
    merged: dict[str, Counter] = {}
    for doc in docs:
        data = doc.get("data")
        if isinstance(data, dict):
            for path, info in collect_schema(data).items():
                if path not in merged:
                    merged[path] = Counter()
                merged[path].update(info["types"])

    for path in sorted(merged):
        types = ", ".join(f"{t}×{c}" for t, c in merged[path].items())
        leaf = path.split(".")[-1].replace("[]", "")
        line = f"  {path:35} ({types})"
        print(line)
        print_field_meaning(leaf)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Kiểm tra cấu trúc collection maps trên MongoDB")
    parser.add_argument("--area_id", "-a", type=int, default=None, help="Chỉ xem map của area_id này")
    parser.add_argument("--sample-nodes", type=int, default=2, help="Số node mẫu in ra (mặc định: 2)")
    parser.add_argument("--sample-lines", type=int, default=1, help="Số line mẫu in ra (mặc định: 1)")
    args = parser.parse_args()

    if not settings.mongo_url or not settings.mongo_db:
        print("[!] Thiếu MONGO_URL hoặc MONGO_DB trong .env")
        sys.exit(1)

    print(f"[*] Kết nối MongoDB: {settings.mongo_db}")
    await connect_to_mongo(settings.mongo_url, settings.mongo_db)
    try:
        await inspect_maps(args.area_id, args.sample_nodes, args.sample_lines)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
