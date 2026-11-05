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


def test_showcase_data_is_consistent():
    data = json.loads((DATA / "support_showcase.json").read_text(encoding="utf-8"))
    contours = {c["id"] for c in data["contours"]}
    ids = [m["id"] for m in data["mechanisms"]]
    assert len(ids) == len(set(ids)) >= 20
    for m in data["mechanisms"]:
        assert m["contour"] in contours, m["id"]
        assert set(m["weights"]) == {"reach", "mtk"}
        assert all(1 <= v <= 3 for v in m["weights"].values())
        assert m["name"] and m["metric"] and m["action"]
    assert {lens["id"] for lens in data["lenses"]} == {"reach", "mtk"}
    assert [s["value"] for s in data["statuses"]] == [0, 1, 2, 3]
    demo = data["demo_profile"]["statuses"]
    assert set(demo) <= set(ids) and all(v in (0, 1, 2, 3) for v in demo.values())
    # каждый контур представлен механизмами
    assert {m["contour"] for m in data["mechanisms"]} == contours


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
