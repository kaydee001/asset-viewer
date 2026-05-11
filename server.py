from flask import Flask, render_template, send_from_directory

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
