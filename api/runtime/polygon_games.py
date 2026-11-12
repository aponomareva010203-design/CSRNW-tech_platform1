"""Игровые полигоны: таблица результатов команд (api/runtime/polygon_games.py).

Сами деловые игры («Спин-офф из лаборатории: решения вуза», «Программа
развития: инновационный портфель вуза», «Управленческие ситуации
проректора»; id: spinoff, ecosystem, profile) работают в браузере —
frontend/js/polygon_games.js, сценарии в frontend/js/polygon_games_data.js.
Код сессии задаёт зерно генератора случайных событий, поэтому у всех команд
одной проектной сессии одинаковые события, и результаты честно сравнимы.

Сервер только собирает итоги: AIOS_RUNTIME_DIR/polygon_games/{code}.json —
список {game, team, author, score, outcome, metrics, at}. Одна команда в одной
игре — одна строка (лучший результат и последняя попытка).
"""

from __future__ import annotations

import json
import math
import re
import time
from functools import lru_cache
from pathlib import Path

from .config import get_settings

CODE_RE = re.compile(r"^[A-Za-z0-9_-]{2,32}$")
GAME_RE = re.compile(r"^[a-z0-9-]{2,40}$")
MAX_ENTRIES = 300
MAX_METRICS = 12


class GameError(ValueError):
    """Некорректный результат игры."""


def normalize_code(code) -> str:
    code = str(code or "").strip()
    if not CODE_RE.match(code):
        raise GameError("Код сессии: 2–32 символа, латиница, цифры, «-» или «_»")
    return code.upper()


def _num(value) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(x) or math.isinf(x):
        return 0.0
    return max(-1e12, min(1e12, x))


def clean_result(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise GameError("Ожидается объект результата")
    game = str(raw.get("game") or "")
    if not GAME_RE.match(game):
        raise GameError("Неизвестная игра")
    team = str(raw.get("team") or "").strip()[:60]
    if not team:
        raise GameError("Укажите название команды")
    metrics = {}
    src = raw.get("metrics") if isinstance(raw.get("metrics"), dict) else {}
    for key, val in list(src.items())[:MAX_METRICS]:
        label = str(key).strip()[:60]
        if label:
            metrics[label] = val if isinstance(val, str) and len(val) <= 60 else _num(val)
    return {
        "game": game,
        "team": team,
        "score": round(_num(raw.get("score")), 2),
        "outcome": str(raw.get("outcome") or "").strip()[:160],
        "metrics": metrics,
    }


class GameResultStore:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _path(self, code: str) -> Path:
        return self.root / f"{normalize_code(code)}.json"

    def _read(self, code: str) -> list:
        path = self._path(code)
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data if isinstance(data, list) else []
            except (OSError, ValueError):
                return []
        return []

    def leaderboard(self, code: str, game: str | None = None) -> list:
        rows = self._read(code)
        if game:
            rows = [r for r in rows if r.get("game") == game]
        rows.sort(key=lambda r: r.get("best", r.get("score", 0)), reverse=True)
        return rows

    def submit(self, code: str, raw: dict, author: str = "", user_id: str = "") -> dict:
        res = clean_result(raw)
        rows = self._read(code)
        now = int(time.time())
        key = (res["game"], res["team"].lower())
        row = next((r for r in rows if (r.get("game"), str(r.get("team", "")).lower()) == key), None)
        if row is None:
            if len(rows) >= MAX_ENTRIES:
                raise GameError("Таблица результатов этой сессии заполнена")
            row = {"game": res["game"], "team": res["team"], "attempts": 0, "best": res["score"]}
            rows.append(row)
        row.update({
            "score": res["score"],
            "outcome": res["outcome"],
            "metrics": res["metrics"],
            "author": str(author or "")[:80],
            "user_id": user_id,
            "at": now,
        })
        row["attempts"] = int(row.get("attempts", 0)) + 1
        row["best"] = max(_num(row.get("best")), res["score"])
        path = self._path(code)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(path)
        return row


@lru_cache(maxsize=1)
def get_store() -> GameResultStore:
    return GameResultStore(get_settings().runtime_dir / "polygon_games")
