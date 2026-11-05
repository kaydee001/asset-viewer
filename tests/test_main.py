import os

import main


def touch(folder, name):
    path = folder / name
    path.write_bytes(b"x")
    return str(path)


def test_startup_files_collects_the_model_and_its_sidecars(tmp_path):
    model = touch(tmp_path, "car.gltf")
    touch(tmp_path, "car.bin")
    touch(tmp_path, "paint.PNG")
    touch(tmp_path, "notes.txt")  # not a sidecar type
    files = main.startup_files([model])
    assert files[0] == os.path.abspath(model)
    assert sorted(os.path.basename(f) for f in files) == ["car.bin", "car.gltf", "paint.PNG"]


def test_startup_files_ignores_arguments_that_are_not_models(tmp_path):
    assert main.startup_files(["--debug", str(tmp_path / "missing.glb")]) == []
    assert main.startup_files([touch(tmp_path, "readme.txt")]) == []


def test_new_formats_are_accepted(tmp_path):
    for name in ("a.stl", "b.ply", "c.3mf"):
        assert main.startup_files([touch(tmp_path, name)])[0].endswith(name)


def test_only_the_first_model_argument_is_opened(tmp_path):
    first = touch(tmp_path, "a.glb")
    second = touch(tmp_path, "b.glb")
    assert main.startup_files([first, second])[0] == os.path.abspath(first)


def test_model_extension_match_is_case_insensitive(tmp_path):
    assert main.startup_files([touch(tmp_path, "SHIP.GLB")])


def test_pick_port_returns_a_usable_port():
    port = main.pick_port()
    assert 0 < port < 65536


def test_pick_port_falls_back_when_preferred_is_taken(monkeypatch):
    import socket
    with socket.socket() as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen()
        taken = busy.getsockname()[1]
        monkeypatch.setattr(main, "PREFERRED_PORT", taken)
        assert main.pick_port() != taken


def test_wait_for_server_returns_once_a_port_accepts():
    import socket
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        main.wait_for_server(listener.getsockname()[1], timeout=2)


def test_wait_for_server_times_out_on_a_closed_port():
    import socket
    import pytest
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        closed = s.getsockname()[1]
    with pytest.raises(RuntimeError):
        main.wait_for_server(closed, timeout=0.3)


def test_dark_title_bar_does_nothing_off_windows(monkeypatch):
    monkeypatch.setattr(main.sys, "platform", "linux")
    assert main.set_dark_title_bar(object(), True) is False
