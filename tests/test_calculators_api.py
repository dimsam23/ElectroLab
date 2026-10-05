"""Test endpoint API kalkulator memakai Flask test client."""
import pytest

from electrolab import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def post(client, path, payload):
    return client.post(f"/api/calculators/{path}", json=payload)


def test_ohm_api(client):
    response = post(
        client,
        "ohm",
        {"voltage": {"value": "12", "unit": "V"}, "resistance": {"value": "1", "unit": "k\u03a9"}},
    )
    data = response.get_json()
    assert response.status_code == 200
    assert data["ok"] is True
    assert data["result"]["values"]["current"] == pytest.approx(0.012)


def test_ohm_api_accepts_decimal_comma(client):
    response = post(
        client,
        "ohm",
        {"voltage": {"value": "4,5", "unit": "V"}, "resistance": {"value": "1", "unit": "kohm"}},
    )
    assert response.get_json()["result"]["values"]["current"] == pytest.approx(0.0045)


def test_ohm_api_error_returns_400(client):
    response = post(client, "ohm", {"voltage": {"value": "12", "unit": "V"}})
    data = response.get_json()
    assert response.status_code == 400
    assert data["ok"] is False
    assert "two values" in data["error"]


def test_ohm_api_rejects_text_value(client):
    response = post(
        client,
        "ohm",
        {"voltage": {"value": "abc", "unit": "V"}, "resistance": {"value": "1", "unit": "ohm"}},
    )
    assert response.status_code == 400


def test_series_api_skips_empty_rows(client):
    payload = {
        "resistors": [
            {"value": "100", "unit": "ohm"},
            {"value": "220", "unit": "ohm"},
            {"value": "", "unit": "ohm"},
            {"value": "330", "unit": "ohm"},
        ]
    }
    data = post(client, "series", payload).get_json()
    assert data["result"]["values"]["resistance"] == pytest.approx(650)


def test_convert_api(client):
    data = post(
        client, "convert", {"quantity": "voltage", "value": "1500", "from": "mV", "to": "V"}
    ).get_json()
    assert data["result"]["value"] == pytest.approx(1.5)


def test_color_code_api(client):
    data = post(
        client,
        "color-code",
        {"band1": "brown", "band2": "black", "multiplier": "red", "tolerance": "gold"},
    ).get_json()
    assert data["result"]["values"]["resistance"] == pytest.approx(1000)


def test_rc_api(client):
    data = post(
        client,
        "rc",
        {"resistance": {"value": "10", "unit": "kohm"}, "capacitance": {"value": "100", "unit": "uF"}},
    ).get_json()
    assert data["result"]["values"]["time_constant"] == pytest.approx(1.0)
    assert data["result"]["display"]["time_constant"] == "1 s"


def test_invalid_json_returns_400(client):
    response = client.post(
        "/api/calculators/ohm", data="not json", content_type="application/json"
    )
    assert response.status_code == 400


def test_options_endpoint(client):
    data = client.get("/api/calculators/options").get_json()
    assert data["ok"] is True
    assert "voltage" in data["result"]["units"]
    assert "capacitance" in data["result"]["units"]
    assert len(data["result"]["colors"]["digits"]) == 10

def test_energy_api(client):
    data = post(
        client,
        "energy",
        {"power": {"value": "6", "unit": "W"}, "time": {"value": "2", "unit": "h"}},
    ).get_json()
    assert data["ok"] is True
    assert data["result"]["values"]["energy"] == pytest.approx(43200)
    assert data["result"]["extras"][0][1] == "12 Wh"


def test_energy_api_error_returns_400(client):
    response = post(client, "energy", {"power": {"value": "6", "unit": "W"}})
    assert response.status_code == 400


def test_options_include_time_and_energy(client):
    units = client.get("/api/calculators/options").get_json()["result"]["units"]
    assert "h" in units["time"]["units"]
    assert "kWh" in units["energy"]["units"]