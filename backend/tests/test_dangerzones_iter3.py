"""
Iteration 3 - extra targeted tests for the exact scenarios in the bug report:
- Click radar/police/accident/obstacle/travaux on home page must yield a POST
  that returns a proper {id, lat, lon, type, label, confirmations, created_at, device_id}.
- POST all 5 types at Paris coords, then GET radius_km=5 around Paris must return all 5.
- POST a NYC zone, then GET around Paris (radius_km=5) must NOT include it.
- Behavior when X-Device-Id is missing.
"""
import pytest


PARIS = (48.8566, 2.3522)
NYC = (40.7128, -74.0060)


TYPES_AND_LABELS = [
    ("speed_camera", "Radar"),
    ("police", "Police / Contrôle"),
    ("accident", "Accident"),
    ("hazard", "Obstacle / Danger"),
    ("construction", "Travaux"),
]


class TestIter3DangerZonesEndToEnd:
    def test_post_all_5_types_at_paris_then_get_includes_all(self, api_client, base_url):
        created_ids = {}
        # POST each of the 5 types at the *same* Paris coordinates
        for ztype, label in TYPES_AND_LABELS:
            r = api_client.post(
                f"{base_url}/api/danger-zones",
                json={"lat": PARIS[0], "lon": PARIS[1], "type": ztype, "note": f"TEST_iter3_{ztype}"},
            )
            assert r.status_code == 200, r.text
            body = r.json()
            # shape from review_request
            for k in ("id", "lat", "lon", "type", "label", "confirmations", "created_at", "device_id"):
                assert k in body, f"missing {k} for type={ztype}: {body}"
            assert body["type"] == ztype
            assert body["label"] == label
            assert body["lat"] == PARIS[0]
            assert body["lon"] == PARIS[1]
            assert body["confirmations"] == 1
            created_ids[ztype] = body["id"]

        # GET around Paris with radius_km=5 must include all 5 created ids,
        # each with the correct French label.
        g = api_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": PARIS[0], "lon": PARIS[1], "radius_km": 5},
        )
        assert g.status_code == 200, g.text
        zones = g.json()
        assert isinstance(zones, list)
        zone_by_id = {z["id"]: z for z in zones}
        for ztype, label in TYPES_AND_LABELS:
            zid = created_ids[ztype]
            assert zid in zone_by_id, f"created {ztype} zone {zid} missing from GET result"
            assert zone_by_id[zid]["label"] == label
            assert zone_by_id[zid]["type"] == ztype

    def test_radius_filter_excludes_nyc_when_querying_paris(self, api_client, base_url):
        # POST a hazard in NYC
        r = api_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": NYC[0], "lon": NYC[1], "type": "hazard", "note": "TEST_iter3_nyc"},
        )
        assert r.status_code == 200, r.text
        nyc_id = r.json()["id"]

        # GET around Paris with radius_km=5 must NOT return the NYC zone
        g = api_client.get(
            f"{base_url}/api/danger-zones",
            params={"lat": PARIS[0], "lon": PARIS[1], "radius_km": 5},
        )
        assert g.status_code == 200
        ids = [z["id"] for z in g.json()]
        assert nyc_id not in ids, "NYC zone leaked into Paris radius=5km result"

    def test_post_without_device_header_returns_400(self, anon_client, base_url):
        # Documented behavior: backend requires X-Device-Id and rejects cleanly with 400.
        r = anon_client.post(
            f"{base_url}/api/danger-zones",
            json={"lat": PARIS[0], "lon": PARIS[1], "type": "police"},
        )
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "X-Device-Id" in detail
