"""Desktop entry point.

Starts the Flask server (server.py) on a background thread, then shows it
inside a PyQt5 window using an embedded Chromium (QtWebEngine). All the actual
viewer logic lives in static/*.js.

usage: python main.py [model.glb] [--debug]
"""
from PyQt5.QtWidgets import QApplication, QFileDialog, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QTimer, QUrl
import ctypes
import os
import server
import socket
import sys
import threading
import time

# a fixed port keeps the page origin stable, so saved settings survive restarts
PREFERRED_PORT = 47831

# what counts as a model, and which neighbouring files get loaded along with it
MODEL_EXTENSIONS = (".glb", ".gltf", ".fbx", ".obj", ".stl", ".ply", ".3mf")
SIDECAR_EXTENSIONS = (".bin", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".webp", ".bmp")


def pick_port():
    # try the preferred port first, fall back to any free one (port 0 = let the OS choose)
    for port in (PREFERRED_PORT, 0):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
            except OSError:
                continue
            return s.getsockname()[1]


def wait_for_server(port, timeout=10):
    # block until flask accepts connections so the window never opens on an error page
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("flask server did not start")


def startup_files(args):
    # the model passed on the command line plus its neighbours (.bin, .mtl, textures)
    models = [a for a in args if os.path.isfile(a) and a.lower().endswith(MODEL_EXTENSIONS)]
    if not models:
        return []
    model = os.path.abspath(models[0])
    folder = os.path.dirname(model)
    files = [model]
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if path != model and os.path.isfile(path) and name.lower().endswith(SIDECAR_EXTENSIONS):
            files.append(path)
    return files


def set_dark_title_bar(window, dark):
    # the native title bar is outside the page, so it is told separately to follow the theme.
    # windows 10 (1809+) and 11 only; anywhere else, or if the call fails, it stays as it is
    if sys.platform != "win32":
        return False
    value = ctypes.c_int(1 if dark else 0)
    hwnd = int(window.winId())
    # 20 = DWMWA_USE_IMMERSIVE_DARK_MODE, 19 on the first builds that had it
    for attribute in (20, 19):
        if ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, attribute, ctypes.byref(value), ctypes.sizeof(value)) == 0:
            return True
    return False


def save_download(item):
    # QtWebEngine drops downloads (like the screenshot png) unless the app accepts them
    path, _ = QFileDialog.getSaveFileName(None, "save", item.path())
    if path:
        item.setPath(path)
        item.accept()
    else:
        item.cancel()


if __name__ == "__main__":
    args = sys.argv[1:]
    debug = any(a.startswith("--debug") and not a.endswith("=False") for a in args)
    if debug:
        # inspect the page from a normal browser at http://localhost:9222
        os.environ.setdefault("QTWEBENGINE_REMOTE_DEBUGGING", "9222")

    server.set_startup_files(startup_files(args))

    port = pick_port()
    # flask runs in a daemon thread, it dies with the window
    thread1 = threading.Thread(target=server.run_flask, args=(port,), daemon=True)
    thread1.start()
    wait_for_server(port)

    # --- qt window: just a browser pointed at the local server ---
    qt_app = QApplication(sys.argv)

    window = QMainWindow()
    window.setWindowTitle("asset viewer")
    window.resize(1280, 780)

    browser = QWebEngineView()
    browser.page().profile().downloadRequested.connect(save_download)
    browser.titleChanged.connect(window.setWindowTitle)
    browser.setUrl(QUrl(f"http://127.0.0.1:{port}/" + ("?debug" if debug else "")))

    window.setCentralWidget(browser)

    window.show()

    # keep the title bar in step with the page's dark / light theme (checked twice a second)
    title_bar_dark = []
    def sync_title_bar():
        def apply(dark):
            if dark is not None and title_bar_dark != [dark]:
                title_bar_dark[:] = [dark]
                set_dark_title_bar(window, dark)
        browser.page().runJavaScript("document.body.classList.contains('dark')", apply)
    theme_timer = QTimer()
    theme_timer.timeout.connect(sync_title_bar)
    theme_timer.start(500)
    sys.exit(qt_app.exec_())
