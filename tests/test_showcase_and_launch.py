"""Витрина механизмов поддержки, агент «Оценщик ИА», новые базы знаний и
скрипт запуска scripts/launch.py (выбор браузера, порт)."""

import json
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
sys.path.insert(0, str(ROOT / "scripts"))

import launch  # noqa: E402
from api.runtime import text_search  # noqa: E402


def _ecosystem():
    text = (ROOT / "frontend" / "js" / "support_ecosystem_data.js").read_text(encoding="utf-8")
    body = text.split("window.AIOS_SUPPORT_ECOSYSTEM = ", 1)[1].rstrip().rstrip(";")
    return json.loads(body)


def test_ecosystem_data_is_consistent():
    data = _ecosystem()
    stages = [s["id"] for s in data["stages"]]
    cats = {c["id"] for c in data["categories"]}
    levels = {lv["id"] for lv in data["levels"]}
    ids = [m["id"] for m in data["measures"]]
    assert len(ids) == len(set(ids)) >= 40
    for m in data["measures"]:
        assert m["category"] in cats and m["level"] in levels, m["id"]
        assert stages.index(m["stage_from"]) <= stages.index(m["stage_to"]), m["id"]
        assert m["name"] and m["operator"] and m["description"], m["id"]
        assert not m["url"] or m["url"].startswith("https://"), m["id"]
    # каждый тип мер и каждый этап пути представлены
    assert {m["category"] for m in data["measures"]} == cats
    covered = set()
    for m in data["measures"]:
        covered.update(stages[stages.index(m["stage_from"]):stages.index(m["stage_to"]) + 1])
    assert covered == set(stages)


def test_showcase_page_loads_data_script_before_logic():
    html = (ROOT / "frontend" / "showcase.html").read_text(encoding="utf-8")
    assert html.index("js/support_ecosystem_data.js") < html.index("js/showcase.js")


def test_showcase_page_in_every_sidebar():
    for page in (ROOT / "frontend").glob("*.html"):
        if page.name == "privacy-policy.html":
            continue
        assert 'href="showcase.html"' in page.read_text(encoding="utf-8"), page.name


def test_ip_asset_rag_search():
    hits = text_search.search("rag-1a0e5c0106", "IPscore правовая сила широта формулы", limit=3)
    assert "04_skoring_rid.md" in [h["filename"] for h in hits[:2]]
    hits = text_search.search("rag-1a0e5c0107", "хозобщество не становится МТК автоматически", limit=3)
    assert hits and hits[0]["filename"] == "04_put_k_mtk.md"


def test_ip_asset_evaluator_is_suggested():
    from api.runtime import datarepo

    found = datarepo.suggest_skills("помоги сформировать методику оценки интеллектуальных активов вуза")
    assert found and found[0]["id"] == "ip-asset-evaluator"


def test_launch_menu_answer():
    opts = launch.menu_options({"chrome": "/x/chrome", "firefox": "/x/ff"})
    assert opts[0] == launch.DEFAULT and set(opts) == {"default", "chrome", "firefox"}
    assert launch.resolve_answer("", opts, "chrome") == "chrome"
    assert launch.resolve_answer(None, opts, "chrome") == "chrome"
    assert launch.resolve_answer("1", opts, "chrome") == "default"
    assert launch.resolve_answer("99", opts, "firefox") == "firefox"
    assert launch.resolve_answer("abc", opts, "default") == "default"


def test_launch_skips_busy_foreign_port():
    with socket.socket() as busy:
        busy.bind((launch.HOST, 0))
        busy.listen(1)
        port = busy.getsockname()[1]
        chosen, running = launch.pick_port(port)
        assert chosen != port and not running
