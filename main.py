from PyQt5.QtWidgets import QApplication, QFileDialog, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
import server
import socket
import sys
import threading
import time


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
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


def save_download(item):
    # QtWebEngine drops downloads (like the screenshot png) unless the app accepts them
    path, _ = QFileDialog.getSaveFileName(None, "save", item.path())
    if path:
        item.setPath(path)
        item.accept()
    else:
        item.cancel()


if __name__ == "__main__":
    port = free_port()
    thread1 = threading.Thread(target=server.run_flask, args=(port,), daemon=True)
    thread1.start()
    wait_for_server(port)

    qt_app = QApplication(sys.argv)

    window = QMainWindow()
    window.setWindowTitle("asset viewer")
    window.resize(1280, 780)

    browser = QWebEngineView()
    browser.page().profile().downloadRequested.connect(save_download)
    browser.setUrl(QUrl(f"http://127.0.0.1:{port}/"))

    window.setCentralWidget(browser)

    window.show()
    sys.exit(qt_app.exec_())
