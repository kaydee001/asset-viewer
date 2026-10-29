from PyQt5.QtWidgets import QApplication, QFileDialog, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
import os
import server
import socket
import sys
import threading
import time

# a fixed port keeps the page origin stable, so saved settings survive restarts
PREFERRED_PORT = 47831

MODEL_EXTENSIONS = (".glb", ".gltf", ".fbx", ".obj")
SIDECAR_EXTENSIONS = (".bin", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".webp", ".bmp")


def pick_port():
    for port in (PREFERRED_PORT, 0):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
            except OSError:
                continue
            return s.getsockname()[1]


def wait_for_server(port, timeout=10):
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
    thread1 = threading.Thread(target=server.run_flask, args=(port,), daemon=True)
    thread1.start()
    wait_for_server(port)

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
    sys.exit(qt_app.exec_())
