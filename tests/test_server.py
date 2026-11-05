import os

import pytest

import server

SAMPLES = os.path.join(os.path.dirname(__file__), "..", "samples")


@pytest.fixture
def client():
    server.set_startup_files([])
    return server.app.test_client()


def test_index_serves_the_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Asset Viewer" in response.data


def test_static_scripts_are_served(client):
    assert client.get("/static/viewer.js").status_code == 200
    # the bundled three.js has to be tracked by git, a fresh clone is blank without it
    assert client.get("/static/vendor/three/build/three.module.js").status_code == 200


def test_no_startup_files_by_default(client):
    assert client.get("/startup-files").get_json() == []


def test_startup_files_are_listed_and_served(client):
    server.set_startup_files([os.path.join(SAMPLES, "cube.glb")])
    items = client.get("/startup-files").get_json()
    assert items == [{"name": "cube.glb", "url": "/startup-file/0"}]
    assert client.get(items[0]["url"]).data[:4] == b"glTF"


def test_unknown_startup_file_is_404(client):
    assert client.get("/startup-file/3").status_code == 404


def test_startup_file_index_must_be_an_integer(client):
    assert client.get("/startup-file/abc").status_code == 404
    assert client.get("/startup-file/-1").status_code == 404


def test_set_startup_files_stores_absolute_paths():
    server.set_startup_files(["samples/cube.glb"])
    assert all(os.path.isabs(p) for p in server.startup_files)
    server.set_startup_files([])


def test_hdri_maps_are_served(client):
    assert client.get("/hdri/hdri_1.hdr").status_code == 200


def test_missing_hdri_is_404(client):
    assert client.get("/hdri/nope.hdr").status_code == 404
    # no escaping the hdri folder
    assert client.get("/hdri/../server.py").status_code == 404
