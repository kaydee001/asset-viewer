"""Tiny local Flask server.

It only serves the page + static files, the HDRI maps, and any model files
passed on the command line. Nothing is uploaded anywhere; dropped files are
read in the browser.
"""
from flask import Flask, abort, jsonify, render_template, send_file, send_from_directory
import os

app = Flask(__name__)

# always revalidate static files so an updated app never shows stale scripts
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

# files given on the command line, opened by the page on startup
startup_files = []


# called by main.py before the server starts
def set_startup_files(paths):
    startup_files[:] = [os.path.abspath(p) for p in paths]


# runs on a background thread (see main.py); the reloader would spawn a second process
def run_flask(port):
    app.run(port=port, debug=False, use_reloader=False)


@app.route("/")
def index():
    return render_template("index.html")


# the page asks for this on load; if it lists anything it downloads and opens it
@app.route("/startup-files")
def list_startup_files():
    return jsonify([
        {"name": os.path.basename(path), "url": f"/startup-file/{i}"}
        for i, path in enumerate(startup_files)
    ])


# files are served by index, so the page never sends a path of its own
@app.route("/startup-file/<int:index>")
def serve_startup_file(index):
    if index >= len(startup_files):
        abort(404)
    return send_file(startup_files[index])


# hdri maps live in ./hdri next to the app (not committed, see readme)
@app.route("/hdri/<path:filename>")
def serve_hdri(filename):
    return send_from_directory("hdri", filename)
