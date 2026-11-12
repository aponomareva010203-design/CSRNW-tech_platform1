"""Конструктор дашборда (личные раскладки) и таблица результатов игровых полигонов."""

import pytest

from api.runtime import dashboards, polygon_games
from api.runtime.config import get_settings

ADMIN_LOGIN = "a.ponomareva@csr-nw.ru"
ADMIN_PASSWORD = "1234"


@pytest.fixture(autouse=True)
def _env(monkeypatch, tmp_path):
    from api.routers import auth as auth_router

    monkeypatch.setenv("AIOS_ADMIN_LOGIN", ADMIN_LOGIN)
    monkeypatch.setenv("AIOS_ADMIN_PASSWORD", ADMIN_PASSWORD)
    monkeypatch.setenv("AIOS_RUNTIME_DIR", str(tmp_path / "rt"))
    caches = (get_settings, dashboards.get_store, polygon_games.get_store, auth_router.get_user_store,
              auth_router.get_token_store, auth_router.get_confirmation_store)
    for c in caches:
        c.cache_clear()
    yield
    for c in caches:
        c.cache_clear()


def _client():
    from fastapi.testclient import TestClient

    from api.main import app

    return TestClient(app)


def _token(client):
    resp = client.post("/api/auth/login", json={"login": ADMIN_LOGIN, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


# ---------- конструктор дашборда ----------


def test_clean_bundle_drops_unknown_widgets_and_fixes_active():
    data = dashboards.clean_bundle({
        "active": "nope",
        "layouts": [{
            "id": "d-1", "name": "  ЦТТ  ", "kpis": ["patents", 5],
            "widgets": [
                {"id": "wTrl", "type": "builtin", "size": "xl"},
                {"id": "c1", "type": "chart", "size": "huge", "cfg": {"dataset": "patents"}},
                {"id": "c1", "type": "note"},            # дубль id
                {"id": "bad id!", "type": "chart"},       # некорректный id
                {"id": "x", "type": "script"},            # неизвестный тип
            ],
        }],
    })
    lay = data["layouts"][0]
    assert data["active"] == "d-1"
    assert lay["name"] == "ЦТТ" and lay["kpis"] == ["patents"]
    assert [w["id"] for w in lay["widgets"]] == ["wTrl", "c1"]
    assert lay["widgets"][1]["size"] == "m"


def test_layout_keeps_meta_and_source():
    data = dashboards.clean_bundle({"layouts": [{
        "name": "CSV", "meta": {"step": "viz", "purpose": "Решать о поддержке"},
        "source": {"kind": "upload", "name": "p.csv", "tables": {"data": {"title": "p", "rows": [{"a": 1}]}}},
        "widgets": [{"id": "k1", "type": "kpi", "size": "s", "cfg": {"table": "data", "agg": "count"}},
                    {"id": "s1", "type": "section"}, {"id": "a1", "type": "actions", "cfg": {"items": []}}],
    }, {"name": "Чужой источник", "source": {"kind": "url", "href": "http://x"}}]})
    first, second = data["layouts"]
    assert first["meta"]["step"] == "viz" and first["source"]["tables"]["data"]["rows"] == [{"a": 1}]
    assert [w["type"] for w in first["widgets"]] == ["kpi", "section", "actions"]
    assert second["source"] == {"kind": "demo"}


def test_manual_source_is_kept():
    rows = [{"name": "Лицензионные договоры", "year": 2026, "plan": 10, "fact": 7, "unit": "ед."}]
    data = dashboards.clean_bundle({"layouts": [{"name": "Вручную", "source": {"kind": "manual", "tables": {"indicators": rows}}}]})
    assert data["layouts"][0]["source"] == {"kind": "manual", "tables": {"indicators": rows}}


def test_too_big_source_is_rejected():
    rows = [{"text": "x" * 100} for _ in range(7000)]
    with pytest.raises(dashboards.DashboardError):
        dashboards.clean_bundle({"layouts": [{"source": {"kind": "upload", "tables": {"t": {"rows": rows}}}}]})


def test_too_big_note_is_rejected():
    with pytest.raises(dashboards.DashboardError):
        dashboards.clean_bundle({"layouts": [{"widgets": [{"id": "n", "type": "note", "cfg": {"text": "x" * 5000}}]}]})


def test_dashboards_api_roundtrip_and_auth():
    client = _client()
    assert client.get("/api/dashboards").status_code == 401
    h = _token(client)
    assert client.get("/api/dashboards", headers=h).json() == {"active": "", "layouts": []}
    bundle = {"active": "d-a", "layouts": [
        {"id": "d-a", "name": "Мой", "kpis": ["stale"], "widgets": [{"id": "c9", "type": "metric", "size": "s", "cfg": {"dataset": "projects", "agg": "count"}}]},
        {"id": "d-b", "name": "Второй", "kpis": [], "widgets": []},
    ]}
    resp = client.put("/api/dashboards", json=bundle, headers=h)
    assert resp.status_code == 200
    got = client.get("/api/dashboards", headers=h).json()
    assert got["active"] == "d-a"
    assert [l["name"] for l in got["layouts"]] == ["Мой", "Второй"]
    too_many = {"layouts": [{"name": str(i)} for i in range(dashboards.MAX_LAYOUTS + 1)]}
    assert client.put("/api/dashboards", json=too_many, headers=h).status_code == 422


# ---------- игровые полигоны ----------


def test_game_results_keep_best_and_sort():
    client = _client()
    h = _token(client)
    send = lambda team, score: client.post("/api/polygons/games/results", headers=h, json={
        "code": "spb-26", "game": "spinoff", "team": team, "score": score, "outcome": "Цель достигнута",
        "role": "Руководитель ЦТТ", "metrics": {"УГТ": 8}})
    assert send("Альфа", 30).status_code == 200
    assert send("Бета", 45).status_code == 200
    row = send("альфа", 12).json()  # та же команда, регистр не важен
    assert row["attempts"] == 2 and row["best"] == 30 and row["score"] == 12
    board = client.get("/api/polygons/games/leaderboard", params={"code": "SPB-26", "game": "spinoff"}).json()
    assert board["code"] == "SPB-26"
    assert [r["team"] for r in board["items"]] == ["Бета", "Альфа"]
    assert board["items"][0]["role"] == "Руководитель ЦТТ"
    assert "user_id" not in board["items"][0]
    other = client.get("/api/polygons/games/leaderboard", params={"code": "spb-26", "game": "ecosystem"}).json()
    assert other["items"] == []


def test_game_results_validation():
    client = _client()
    assert client.post("/api/polygons/games/results", json={"code": "x1", "game": "spinoff", "team": "A"}).status_code == 401
    h = _token(client)
    bad_code = {"code": "../etc", "game": "spinoff", "team": "A", "score": 1}
    assert client.post("/api/polygons/games/results", headers=h, json=bad_code).status_code == 422
    no_team = {"code": "ok-1", "game": "spinoff", "team": " ", "score": 1}
    assert client.post("/api/polygons/games/results", headers=h, json=no_team).status_code == 422
    assert client.get("/api/polygons/games/leaderboard", params={"code": "a b"}).status_code == 422
