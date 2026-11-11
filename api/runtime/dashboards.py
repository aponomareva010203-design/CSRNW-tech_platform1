"""Конструктор дашборда: личные раскладки участников (api/runtime/dashboards.py).

В «Конструкторе дашборда» (dashboard-builder.html, js/dashboard_builder.js)
каждый участник проектной сессии собирает свои дашборды по шагам: цель и
аудитория → источник данных → показатели → визуализации → компоновка →
проверка. Раскладка описывает элементы (KPI, цели, графики, таблицы, решения,
заметки, разделы), их порядок и размер; meta — цель, аудитория, вопросы,
шаг сборки; source — источник данных: демо-данные вуза (data/dashboard.json)
или свои загруженные таблицы (CSV/JSON) — их строки хранятся в раскладке,
чтобы дашборд открывался с любого компьютера.

Хранение: AIOS_RUNTIME_DIR/dashboards/{user_id}.json —
{"active": id, "layouts": [{id, name, kpis, widgets, meta, source, updated_at}]}.
Без входа фронтенд хранит то же самое в localStorage.
"""

from __future__ import annotations

import json
import re
import secrets
import time
from functools import lru_cache
from pathlib import Path

from .config import get_settings

USER_ID_RE = re.compile(r"^[a-f0-9]{12}$")
LAYOUT_ID_RE = re.compile(r"^[a-z0-9-]{1,40}$")
WIDGET_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")

MAX_LAYOUTS = 20
MAX_WIDGETS = 40
MAX_KPIS = 12
MAX_CFG_BYTES = 4000  # настройки одного виджета (в т.ч. текст заметки)
MAX_META_BYTES = 4000
MAX_SOURCE_BYTES = 600_000  # свои загруженные таблицы одного дашборда
MAX_BUNDLE_BYTES = 3_000_000
# kpi, goal, chart, table, note, actions, section — конструктор;
# builtin, metric — раскладки первой версии конструктора (совместимость)
WIDGET_TYPES = {"kpi", "goal", "chart", "table", "note", "actions", "section", "builtin", "metric"}
SIZES = {"s", "m", "l", "xl"}


class DashboardError(ValueError):
    """Некорректная раскладка дашборда."""


def _text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def clean_widget(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    wtype = raw.get("type")
    wid = str(raw.get("id") or "")
    if wtype not in WIDGET_TYPES or not WIDGET_ID_RE.match(wid):
        return None
    cfg = raw.get("cfg") if isinstance(raw.get("cfg"), dict) else {}
    if len(json.dumps(cfg, ensure_ascii=False)) > MAX_CFG_BYTES:
        raise DashboardError("Слишком большие настройки виджета (длинная заметка?)")
    return {
        "id": wid,
        "type": wtype,
        "size": raw.get("size") if raw.get("size") in SIZES else "m",
        "title": _text(raw.get("title"), 120),
        "cfg": cfg,
    }


def clean_layout(raw) -> dict:
    if not isinstance(raw, dict):
        raise DashboardError("Раскладка должна быть объектом")
    lid = str(raw.get("id") or "")
    if not LAYOUT_ID_RE.match(lid):
        lid = "d-" + secrets.token_hex(4)
    widgets = []
    seen = set()
    for w in (raw.get("widgets") or [])[:MAX_WIDGETS]:
        cw = clean_widget(w)
        if cw and cw["id"] not in seen:
            seen.add(cw["id"])
            widgets.append(cw)
    kpis = [_text(k, 40) for k in (raw.get("kpis") or []) if isinstance(k, str)][:MAX_KPIS]
    meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    if len(json.dumps(meta, ensure_ascii=False)) > MAX_META_BYTES:
        raise DashboardError("Слишком длинное описание цели дашборда")
    source = raw.get("source") if isinstance(raw.get("source"), dict) else {"kind": "demo"}
    if source.get("kind") not in ("demo", "upload"):
        source = {"kind": "demo"}
    if len(json.dumps(source, ensure_ascii=False)) > MAX_SOURCE_BYTES:
        raise DashboardError("Загруженные данные дашборда больше 600 КБ — сократите таблицу или храните её только в браузере")
    return {
        "id": lid,
        "name": _text(raw.get("name"), 80) or "Мой дашборд",
        "kpis": kpis,
        "widgets": widgets,
        "meta": meta,
        "source": source,
        "updated_at": int(time.time()),
    }


def clean_bundle(raw) -> dict:
    if not isinstance(raw, dict):
        raise DashboardError("Ожидается {active, layouts}")
    layouts = raw.get("layouts")
    if not isinstance(layouts, list):
        raise DashboardError("Нет списка layouts")
    if len(layouts) > MAX_LAYOUTS:
        raise DashboardError(f"Не больше {MAX_LAYOUTS} дашбордов на участника")
    cleaned = []
    ids = set()
    for item in layouts:
        lay = clean_layout(item)
        if lay["id"] in ids:
            lay["id"] = "d-" + secrets.token_hex(4)
        ids.add(lay["id"])
        cleaned.append(lay)
    if len(json.dumps(cleaned, ensure_ascii=False)) > MAX_BUNDLE_BYTES:
        raise DashboardError("Все дашборды участника вместе больше 3 МБ — удалите лишние")
    active = str(raw.get("active") or "")
    if active not in ids:
        active = cleaned[0]["id"] if cleaned else ""
    return {"active": active, "layouts": cleaned}


class DashboardStore:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _path(self, user_id: str) -> Path:
        if not USER_ID_RE.match(user_id or ""):
            raise DashboardError("Некорректный пользователь")
        return self.root / f"{user_id}.json"

    def get(self, user_id: str) -> dict:
        path = self._path(user_id)
        if path.is_file():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
        return {"active": "", "layouts": []}

    def save(self, user_id: str, raw: dict) -> dict:
        data = clean_bundle(raw)
        path = self._path(user_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(path)
        return data


@lru_cache(maxsize=1)
def get_store() -> DashboardStore:
    return DashboardStore(get_settings().runtime_dir / "dashboards")
