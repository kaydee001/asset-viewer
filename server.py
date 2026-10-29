from flask import Flask, jsonify, render_template, send_file, send_from_directory
import os

app = Flask(__name__)

# always revalidate static files so an updated app never shows stale scripts
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

# files given on the command line, opened by the page on startup
startup_files = []


def set_startup_files(paths):
    startup_files[:] = [os.path.abspath(p) for p in paths]


def run_flask(port):
    app.run(port=port, debug=False, use_reloader=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/startup-files")
def list_startup_files():
    return jsonify([
        {"name": os.path.basename(path), "url": f"/startup-file/{i}"}
        for i, path in enumerate(startup_files)
    ])


@app.route("/startup-file/<int:index>")
def serve_startup_file(index):
    return send_file(startup_files[index])


@app.route("/hdri/<path:filename>")
def serve_hdri(filename):
    return send_from_directory("hdri", filename)
