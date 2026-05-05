from flask import Flask, render_template, send_from_directory

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/models/<path:filename>")
def serve_model(filename):
    return send_from_directory("models", filename)
