from flask import Flask, render_template, send_from_directory

app = Flask(__name__)


def run_flask(port):
    app.run(port=port, debug=False, use_reloader=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/hdri/<path:filename>")
def serve_hdri(filename):
    return send_from_directory("hdri", filename)
