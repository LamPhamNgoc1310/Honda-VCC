from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RCSStatusCode(BaseModel):
    point_id: int
    status_code: int