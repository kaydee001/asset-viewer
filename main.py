from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
import server
import sys
import threading
import time

if __name__ == "__main__":
    thread1 = threading.Thread(target=server.run_flask, daemon=True)
    thread1.start()
    time.sleep(1)

    qt_app = QApplication(sys.argv)

    window = QMainWindow()
    window.setWindowTitle("asset viewer")
    window.resize(1280, 780)

    browser = QWebEngineView()
    browser.setUrl(QUrl("http://127.0.0.1:5000/"))

    window.setCentralWidget(browser)

    window.show()
    sys.exit(qt_app.exec_())
