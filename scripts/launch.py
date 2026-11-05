"""Запуск платформы и открытие браузера (вызывается из start_windows.bat
и start_mac.sh; можно запускать и вручную из корня проекта).

Что делает:
  1. Если платформа уже работает — просто открывает её в браузере.
  2. Предлагает выбрать браузер (Enter или 10 секунд тишины — браузер,
     выбранный в прошлый раз, или браузер по умолчанию). Выбор
     запоминается в файле .aios-browser в корне проекта.
  3. Если порт 8000 занят другой программой — берёт следующий свободный.
  4. Запускает сервер и, как только он ответил, открывает браузер.

Проверка «сервер ответил» идёт прямым подключением к 127.0.0.1, без
прокси — поэтому браузер открывается и на компьютерах с корпоративным
прокси (из-за него раньше проверка через PowerShell/curl могла не
пройти, и браузер не открывался).

    python scripts/launch.py                 # обычный запуск
    python scripts/launch.py --choose        # всегда спросить браузер
    python scripts/launch.py --browser chrome
    python scripts/launch.py --no-browser    # только сервер
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHOICE_FILE = ROOT / ".aios-browser"
HOST = "127.0.0.1"
DEFAULT_PORT = 8000
MENU_TIMEOUT = 10  # секунд на выбор браузера
MARKER = "AIOS"  # есть в <title> главной страницы платформы

DEFAULT = "default"


# ---------------------------------------------------------------- браузеры

def _win_candidates() -> dict[str, list[str]]:
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    local = os.environ.get("LOCALAPPDATA", "")
    return {
        "chrome": [rf"{pf}\Google\Chrome\Application\chrome.exe",
                   rf"{pf86}\Google\Chrome\Application\chrome.exe",
                   rf"{local}\Google\Chrome\Application\chrome.exe"],
        "yandex": [rf"{local}\Yandex\YandexBrowser\Application\browser.exe",
                   rf"{pf}\Yandex\YandexBrowser\Application\browser.exe",
                   rf"{pf86}\Yandex\YandexBrowser\Application\browser.exe"],
        "edge": [rf"{pf86}\Microsoft\Edge\Application\msedge.exe",
                 rf"{pf}\Microsoft\Edge\Application\msedge.exe"],
        "firefox": [rf"{pf}\Mozilla Firefox\firefox.exe",
                    rf"{pf86}\Mozilla Firefox\firefox.exe"],
        "opera": [rf"{local}\Programs\Opera\opera.exe",
                  rf"{local}\Programs\Opera GX\opera.exe"],
    }


MAC_APPS = {
    "safari": "Safari",
    "chrome": "Google Chrome",
    "yandex": "Yandex",
    "edge": "Microsoft Edge",
    "firefox": "Firefox",
    "opera": "Opera",
    "arc": "Arc",
}

LINUX_BINS = {
    "chrome": ["google-chrome", "google-chrome-stable"],
    "chromium": ["chromium", "chromium-browser"],
    "yandex": ["yandex-browser", "yandex-browser-stable"],
    "firefox": ["firefox"],
    "edge": ["microsoft-edge", "microsoft-edge-stable"],
    "opera": ["opera"],
}

TITLES = {
    DEFAULT: "Браузер по умолчанию",
    "chrome": "Google Chrome",
    "chromium": "Chromium",
    "yandex": "Яндекс Браузер",
    "edge": "Microsoft Edge",
    "firefox": "Mozilla Firefox",
    "safari": "Safari",
    "opera": "Opera",
    "arc": "Arc",
}


def detect_browsers() -> dict[str, str]:
    """Установленные браузеры: ключ → путь/имя для запуска."""
    found: dict[str, str] = {}
    if sys.platform.startswith("win"):
        for key, paths in _win_candidates().items():
            for p in paths:
                if p and os.path.isfile(p):
                    found[key] = p
                    break
    elif sys.platform == "darwin":
        for key, app in MAC_APPS.items():
            for base in ("/Applications", os.path.expanduser("~/Applications"),
                         "/System/Applications", "/System/Volumes/Preboot/Cryptexes/App/System/Applications"):
                path = os.path.join(base, app + ".app")
                if os.path.isdir(path):
                    found[key] = path
                    break
    else:
        for key, bins in LINUX_BINS.items():
            for b in bins:
                path = shutil.which(b)
                if path:
                    found[key] = path
                    break
    return found


def open_in_browser(url: str, choice: str, browsers: dict[str, str]) -> bool:
    """Открывает url в выбранном браузере; при неудаче — в браузере по умолчанию."""
    target = browsers.get(choice) if choice != DEFAULT else None
    try:
        if target:
            if sys.platform == "darwin":
                subprocess.Popen(["open", "-a", target, url])
            else:
                subprocess.Popen([target, url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
    except OSError:
        pass
    try:
        if sys.platform.startswith("win"):
            os.startfile(url)  # type: ignore[attr-defined]  # браузер по умолчанию Windows
            return True
        if sys.platform == "darwin":
            subprocess.Popen(["open", url])
            return True
    except OSError:
        pass
    return webbrowser.open(url)


# ------------------------------------------------------------- выбор в меню

def read_saved_choice() -> str:
    try:
        value = CHOICE_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return DEFAULT
    return value or DEFAULT


def save_choice(choice: str) -> None:
    try:
        CHOICE_FILE.write_text(choice + "\n", encoding="utf-8")
    except OSError:
        pass


def _input_with_timeout(prompt: str, timeout: float) -> str | None:
    """Строка, введённая пользователем, или None, если время вышло."""
    sys.stdout.write(prompt)
    sys.stdout.flush()
    if sys.platform.startswith("win"):
        import msvcrt

        deadline = time.monotonic() + timeout
        typed = ""
        while time.monotonic() < deadline:
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                if ch in ("\r", "\n"):
                    sys.stdout.write("\n")
                    return typed
                if ch == "\b":
                    if typed:
                        typed = typed[:-1]
                        sys.stdout.write("\b \b")
                else:
                    typed += ch
                    sys.stdout.write(ch)
                sys.stdout.flush()
                deadline = time.monotonic() + timeout  # пользователь печатает — ждём
            else:
                time.sleep(0.05)
        sys.stdout.write("\n")
        return None
    import select

    ready, _, _ = select.select([sys.stdin], [], [], timeout)
    if not ready:
        sys.stdout.write("\n")
        return None
    return sys.stdin.readline().strip()


def menu_options(browsers: dict[str, str]) -> list[str]:
    return [DEFAULT] + [k for k in TITLES if k in browsers]


def resolve_answer(answer: str | None, options: list[str], current: str) -> str:
    """Номер пункта меню → ключ браузера; пусто или ошибка — текущий выбор."""
    if not answer:
        return current
    answer = answer.strip()
    if answer.isdigit() and 1 <= int(answer) <= len(options):
        return options[int(answer) - 1]
    return current


def choose_browser(browsers: dict[str, str], force_menu: bool) -> str:
    saved = read_saved_choice()
    current = saved if saved == DEFAULT or saved in browsers else DEFAULT
    if not sys.stdin or not sys.stdin.isatty():
        return current
    options = menu_options(browsers)
    if len(options) == 1 and not force_menu:
        return current
    print()
    print(" В каком браузере открыть платформу?")
    for i, key in enumerate(options, 1):
        mark = "  <- сейчас" if key == current else ""
        print(f"   {i}. {TITLES[key]}{mark}")
    answer = _input_with_timeout(
        f" Введите номер и нажмите Enter (Enter или {MENU_TIMEOUT} сек. — «{TITLES[current]}»): ",
        MENU_TIMEOUT,
    )
    choice = resolve_answer(answer, options, current)
    save_choice(choice)
    return choice


# ------------------------------------------------------------------ сервер

def port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, port)) == 0


def is_platform(port: int) -> bool:
    """На порту отвечает именно AIOS (запрос без прокси)."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(f"http://{HOST}:{port}/", timeout=2) as resp:
            return MARKER in resp.read(4096).decode("utf-8", "ignore")
    except Exception:
        return False


def pick_port(start: int) -> tuple[int, bool]:
    """(порт, уже_запущена): порт с работающей платформой или первый свободный."""
    for port in range(start, start + 20):
        if not port_busy(port):
            return port, False
        if is_platform(port):
            return port, True
    raise SystemExit(f"Порты {start}–{start + 19} заняты другими программами.")


def wait_and_open(port: int, choice: str, browsers: dict[str, str], timeout: int = 180) -> None:
    url = f"http://localhost:{port}"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if port_busy(port) and is_platform(port):
            if not open_in_browser(url, choice, browsers):
                print(f"\n Не удалось открыть браузер сам. Откройте вручную: {url}\n")
            return
        time.sleep(0.5)
    print(f"\n Сервер долго не отвечает. Попробуйте открыть вручную: {url}\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Запуск AIOS и открытие браузера")
    ap.add_argument("--port", type=int, default=int(os.environ.get("AIOS_PORT", DEFAULT_PORT)))
    ap.add_argument("--browser", help="ключ браузера: default, chrome, yandex, edge, firefox, safari, opera")
    ap.add_argument("--choose", action="store_true", help="показать меню выбора браузера")
    ap.add_argument("--no-browser", action="store_true", help="не открывать браузер")
    args = ap.parse_args(argv)

    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT))

    browsers = detect_browsers()
    port, running = pick_port(args.port)

    if args.no_browser:
        choice = None
    elif args.browser:
        choice = args.browser if args.browser in browsers else DEFAULT
        save_choice(choice)
    else:
        choice = choose_browser(browsers, args.choose)

    url = f"http://localhost:{port}"
    if running:
        print(f" Платформа уже запущена: {url}")
        if choice:
            open_in_browser(url, choice, browsers)
        return 0

    if port != args.port:
        print(f" Порт {args.port} занят другой программой — запускаю на порту {port}.")
    print()
    print(f" Платформа: {url}")
    if choice:
        print(f" Браузер откроется сам ({TITLES.get(choice, choice)}), как только сервер будет готов.")
    print(f" Если не открылся — откройте вручную {url}")
    print()

    if choice:
        threading.Thread(target=wait_and_open, args=(port, choice, browsers), daemon=True).start()

    import uvicorn

    uvicorn.run("api.main:app", host=HOST, port=port)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
