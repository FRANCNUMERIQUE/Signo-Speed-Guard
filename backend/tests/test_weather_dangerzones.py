"""
Tests for NEW Signo endpoints: /api/weather and /api/danger-zones.

- /api/weather uses Open-Meteo public API (no key)
- /api/danger-zones requires X-Device-Id header on POST; GET is anonymous

All test data uses TEST_ prefixed device_ids so conftest can clean it up.
"""

import uuid
import pytest


# -------- /api/weather --------
class TestWeather:
    def test_weather_paris_returns_full_shape(self, anon_client, base_url):
        # Paris coordinates - expected to return real data from Open-Meteo
        r = anon_client.get(f"{base_url}/api/weather", params={"lat": 48.8566, "lon": 2.3522})
        assert r.status_code == 200, r.text
        data = r.json()
        # All required fields must be present
        for k in ("temp_c", "code", "label", "icon", "wind_kmh", "precip_mm", "updated_at"):
            assert k in data, f"missing field {k} in {data}"
        # Real-data sanity (Paris should be reachable by Open-Meteo)
        assert data["temp_c"] is not None, f"Open-Meteo returned no temp_c: {data}"
        assert isinstance(data["temp_c"], (int, float))
        assert isinstance(data["code"], int)
        assert isinstance(data["label"], str) and len(data["label"]) > 0
        assert isinstance(data["icon"], str) and len(data["icon"]) > 0
        # French label set: ensure non-empty and not the fallback "Indisponible"
        assert data["label"] != "Indisponible"
        # Ionicons name should look like a kebab-case identifier
        assert "-" in data["icon"] or data["icon"] in (
            "sunny", "cloud", "rainy", "snow", "thunderstorm",
        )

    def test_weather_label_is_french(self, anon_client, base_url):
        # Sample a few cities; just confirm shape and that label is non-empty French string
        r = anon_client.get(f"{base_url}/api/weather", params={"lat": 43.6047, "lon": 1.4442})  # Toulouse
        assert r.status_code == 200
        data = r.json()
        assert data["label"]
        # Should not contain English-only fallback weather words like "Sunny"/"Rainy" in English
        assert data["label"] not in ("Sunny", "Rainy", "Cloudy")

    def test_weather_extreme_coords_no_500(self, anon_client, base_url):
        # Middle of Pacific - Open-Meteo still serves data, but must not 500
        r = anon_client.get(f"{base_url}/api/weather", params={"lat": 0.0, "lon": -160.0})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "label" in data and "icon" in data

    def test_weather_invalid_coords_graceful(self, anon_client, base_url):
        # Out-of-range coords - Open-Meteo returns 400, server must catch and return fallback
        r = anon_client.get(f"{base_url}/api/weather", params={"lat": 999.0, "lon": 999.0})
        assert r.status_code == 200, r.text
        data = r.json()
        # All fields present
        for k in ("temp_c", "code", "label", "icon", "wind_kmh", "precip_mm", "updated_at"):
            assert k in data
        # Either real data or graceful fallback
        if data["temp_c"] is None:
            assert data["label"] == "Indisponible"
            assert data["icon"] == "cloud-outline"


# -------- /api/danger-zones --------
class TestDangerZonesAuth:
    def test_post_requires_device_header(self, anon_client, base_url):
        # No X-Device-Id header on POST -> 400
        r = anon_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": 48.8566, "lon": 2.3522, "type": "hazard"},
        )
        assert r.status_code == 400, r.text
        assert "X-Device-Id" in r.json().get("detail", "")

    def test_get_does_not_require_device_header(self, anon_client, base_url):
        r = anon_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": 48.8566, "lon": 2.3522, "radius_km": 10},
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


class TestDangerZonesCRUD:
    @pytest.mark.parametrize(
        "ztype,expected_label",
        [
            ("accident", "Accident"),
            ("police", "Police / Contrôle"),
            ("hazard", "Obstacle / Danger"),
            ("speed_camera", "Radar"),
            ("construction", "Travaux"),
        ],
    )
    def test_create_each_type_returns_label(self, api_client, base_url, ztype, expected_label):
        # Spread coords slightly so we have unique points
        lat, lon = 48.85 + 0.0001, 2.35 + 0.0001
        r = api_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": lat, "lon": lon, "type": ztype, "note": f"TEST_{ztype}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and isinstance(data["id"], str)
        assert data["type"] == ztype
        assert data["label"] == expected_label
        assert data["lat"] == lat and data["lon"] == lon
        assert data["confirmations"] == 1
        assert "created_at" in data
        # device_id is the one from X-Device-Id (TEST_*)
        assert data["device_id"].startswith("TEST_")

    def test_create_then_list_persists_and_labels(self, api_client, base_url):
        lat, lon = 45.7640, 4.8357  # Lyon
        r = api_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": lat, "lon": lon, "type": "police", "note": "TEST_persist"},
        )
        assert r.status_code == 200
        created = r.json()

        # Read back via GET in a small radius
        g = api_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": lat, "lon": lon, "radius_km": 1},
        )
        assert g.status_code == 200
        zones = g.json()
        assert isinstance(zones, list) and len(zones) >= 1
        match = next((z for z in zones if z["id"] == created["id"]), None)
        assert match is not None, "created zone not found in list"
        assert match["label"] == "Police / Contrôle"
        assert match["type"] == "police"

    def test_list_radius_filters_out_far_zones(self, api_client, base_url):
        # Create a zone in Paris
        paris = api_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": 48.8566, "lon": 2.3522, "type": "hazard", "note": "TEST_paris"},
        )
        assert paris.status_code == 200
        paris_id = paris.json()["id"]

        # Query around Marseille with small radius -> Paris should NOT appear
        g = api_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": 43.2965, "lon": 5.3698, "radius_km": 5},
        )
        assert g.status_code == 200
        ids = [z["id"] for z in g.json()]
        assert paris_id not in ids, "radius filtering failed: far zone returned"

    def test_list_default_radius_works(self, anon_client, base_url):
        # Anonymous GET, no radius_km param -> default 10 km
        r = anon_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": 48.8566, "lon": 2.3522},
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # Every zone must have a label
        for z in r.json():
            assert "label" in z and z["label"]

    def test_list_response_excludes_mongo_id(self, api_client, base_url):
        # Create and then read
        api_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": 48.8566, "lon": 2.3522, "type": "accident", "note": "TEST_noid"},
        )
        r = api_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": 48.8566, "lon": 2.3522, "radius_km": 1},
        )
        assert r.status_code == 200
        for z in r.json():
            assert "_id" not in z
