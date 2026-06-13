"""
Import map từ file ZIP (compress/compress.json) và lưu vào collection `maps`.

Chuyển đổi nodeArr / lineArr từ dạng mảng (RCS) sang object giống frontend (useZipImport),
rồi gọi save_map — cùng format đang lưu trên MongoDB.

Chạy từ thư mục Server/be:
  python test/import_map_from_zip.py
  python test/import_map_from_zip.py --zip ../../map6.zip --area_id 1
"""

import argparse
import asyncio
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import Any

BE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(BE_DIR, "app")
REPO_ROOT = os.path.dirname(os.path.dirname(BE_DIR))
DEFAULT_ZIP = os.path.join(REPO_ROOT, "map6.zip")

if BE_DIR not in sys.path:
    sys.path.insert(0, BE_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(APP_DIR, ".env"))
load_dotenv(os.path.join(BE_DIR, ".env"))

from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo
from app.services.area_service import save_map

COMPRESS_PATHS = (
    "compress/compress.json",
    "compress.json",
)


def convert_map_data(json_data: dict) -> dict:
    """Giống convertMapData trong useZipImport.jsx."""
    if not json_data.get("nodeKeys") or not json_data.get("lineKeys") or not json_data.get("nodeArr"):
        raise ValueError("Invalid map format: missing nodeKeys, lineKeys, or nodeArr")

    converted_node_arr = []
    for node_array in json_data["nodeArr"]:
        if not isinstance(node_array, list) or len(node_array) < 4:
            continue
        converted_node_arr.append({
            "x": node_array[0],
            "y": node_array[1],
            "type": node_array[2],
            "content": node_array[3],
            "key": node_array[3],
            "name": node_array[4] if len(node_array) > 4 else node_array[3],
            "isTurn": node_array[5] if len(node_array) > 5 else 0,
            "shelfIsTurn": node_array[6] if len(node_array) > 6 else 0,
            "extraTypes": node_array[7] if len(node_array) > 7 else [],
        })

    converted_line_arr = []
    for line_array in json_data.get("lineArr") or []:
        if not isinstance(line_array, list) or len(line_array) < 2:
            continue
        converted_line_arr.append({
            "startNode": line_array[0],
            "endNode": line_array[1],
            "leftWidth": line_array[2] if len(line_array) > 2 else 0,
            "rightWidth": line_array[3] if len(line_array) > 3 else 0,
            "startExpandDistance": line_array[4] if len(line_array) > 4 else 0,
            "endExpandDistance": line_array[5] if len(line_array) > 5 else 0,
            "path": line_array[6] if len(line_array) > 6 else [],
        })

    return {
        **json_data,
        "nodeArr": converted_node_arr,
        "lineArr": converted_line_arr,
    }


def load_compress_json_from_zip(zip_path: str) -> dict:
    path = Path(zip_path)
    if not path.is_file():
        raise FileNotFoundError(f"Không tìm thấy file ZIP: {zip_path}")

    with zipfile.ZipFile(path, "r") as zf:
        names = set(zf.namelist())
        compress_name = next((p for p in COMPRESS_PATHS if p in names), None)
        if not compress_name:
            raise FileNotFoundError(
                f"Không tìm thấy compress.json trong ZIP. Files: {sorted(names)}"
            )
        raw = zf.read(compress_name).decode("utf-8")
        return json.loads(raw)


def summarize_map_data(data: dict) -> None:
    print(f"  nodeArr : {len(data.get('nodeArr') or [])} nodes")
    print(f"  lineArr : {len(data.get('lineArr') or [])} edges")
    print(f"  allPath : {len(data.get('allPath') or [])} segments")
    print(f"  size    : {data.get('width')} x {data.get('height')} (width x height)")


async def import_map(zip_path: str, area_id: int) -> None:
    print(f"[*] Đọc ZIP: {zip_path}")
    raw = load_compress_json_from_zip(zip_path)
    map_data = convert_map_data(raw)

    print("[*] Map sau khi convert:")
    summarize_map_data(map_data)

    print(f"[*] Kết nối MongoDB: {settings.mongo_db}")
    await connect_to_mongo(settings.mongo_url, settings.mongo_db)
    try:
        await save_map(map_data, area_id)
        print(f"[+] Đã lưu map vào collection `maps` với area_id = {area_id}")
        if map_data.get("nodeArr"):
            sample = map_data["nodeArr"][0]
            print(f"    Mẫu node : key={sample.get('key')}, x={sample.get('x')}, y={sample.get('y')}")
        if map_data.get("lineArr"):
            sample = map_data["lineArr"][0]
            print(
                f"    Mẫu line: {sample.get('startNode')} -> {sample.get('endNode')}, "
                f"path points={len(sample.get('path') or [])}"
            )
    finally:
        await close_mongo_connection()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Import map ZIP vào MongoDB (collection maps)")
    parser.add_argument(
        "--zip", "-z",
        default=DEFAULT_ZIP,
        help=f"Đường dẫn file ZIP (mặc định: {DEFAULT_ZIP})",
    )
    parser.add_argument(
        "--area_id", "-a",
        type=int,
        default=1,
        help="area_id để lưu map (mặc định: 1)",
    )
    args = parser.parse_args()

    if not settings.mongo_url or not settings.mongo_db:
        print("[!] Thiếu MONGO_URL hoặc MONGO_DB trong .env")
        sys.exit(1)

    await import_map(args.zip, args.area_id)


if __name__ == "__main__":
    asyncio.run(main())
