"""HTTP-слой конструктора дашборда (api/routers/dashboards.py).

GET /api/dashboards — мои раскладки дашборда {active, layouts};
PUT /api/dashboards — сохранить все мои раскладки целиком.

Логика и ограничения — api/runtime/dashboards.py.
"""

from fastapi import APIRouter, Body, Depends, HTTPException

from ..runtime import dashboards
from ..runtime.dashboards import DashboardError
from .auth import get_current_user

router = APIRouter(prefix="/api")


@router.get("/dashboards")
def get_dashboards(user: dict = Depends(get_current_user)):
    return dashboards.get_store().get(user["id"])


@router.put("/dashboards")
def save_dashboards(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    try:
        return dashboards.get_store().save(user["id"], payload)
    except DashboardError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
