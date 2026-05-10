from flask import Flask, render_template, send_from_directory
from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl
import sys
import threading
import time

app = Flask(__name__)


def run_flask():
    app.run(port=5000, debug=False, use_reloader=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/models/<path:filename>")
def serve_model(filename):
    return send_from_directory("models", filename)


@app.route("/hdri/<path:filename>")
def serve_hdri(filename):
    return send_from_directory("hdri", filename)


thread1 = threading.Thread(target=run_flask, daemon=True)
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
