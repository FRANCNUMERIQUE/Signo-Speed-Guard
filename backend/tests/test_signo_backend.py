"""Signo backend integration tests.
Covers profile, trips, alerts, rewards, speed-limit, and device-id enforcement.
"""
import time
import pytest


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("app") == "Signo API"


# ---------------- Device-Id enforcement ----------------
class TestDeviceIdRequired:
    @pytest.mark.parametrize("method,path,body", [
        ("get", "/api/profile", None),
        ("put", "/api/profile", {"name": "X"}),
        ("get", "/api/trips", None),
        ("post", "/api/trips", {"started_at": "2026-01-01T00:00:00Z", "ended_at": "2026-01-01T00:10:00Z", "distance_km": 1, "duration_min": 10, "avg_speed_kmh": 30, "max_speed_kmh": 40}),
        ("get", "/api/alerts", None),
        ("post", "/api/alerts", {"speed_kmh": 80, "limit_kmh": 50, "lat": 48.85, "lon": 2.35}),
        ("get", "/api/rewards", None),
        ("post", "/api/rewards/claim", {"amount": 1000}),
    ])
    def test_missing_device_id_returns_400(self, anon_client, base_url, method, path, body):
        fn = getattr(anon_client, method)
        r = fn(f"{base_url}{path}", json=body) if body is not None else fn(f"{base_url}{path}")
        assert r.status_code == 400, f"{method.upper()} {path} expected 400, got {r.status_code}: {r.text}"


# ---------------- Profile ----------------
class TestProfile:
    def test_get_profile_creates_default(self, api_client, base_url, device_id):
        r = api_client.get(f"{base_url}/api/profile")
        assert r.status_code == 200
        p = r.json()
        assert p["device_id"] == device_id
        assert p["name"] == "Conducteur"
        assert p["fre_balance"] == 0.0
        assert p["total_distance_km"] == 0.0
        assert p["total_trips"] == 0
        assert p["safety_score"] == 100
        assert p["wallet_ton"] is None

    def test_update_profile_name_and_wallet(self, api_client, base_url):
        r = api_client.put(
            f"{base_url}/api/profile",
            json={"name": "TEST_Driver", "wallet_ton": "EQTestWalletAddress123"},
        )
        assert r.status_code == 200
        p = r.json()
        assert p["name"] == "TEST_Driver"
        assert p["wallet_ton"] == "EQTestWalletAddress123"
        # Verify persistence
        r2 = api_client.get(f"{base_url}/api/profile")
        p2 = r2.json()
        assert p2["name"] == "TEST_Driver"
        assert p2["wallet_ton"] == "EQTestWalletAddress123"


# ---------------- Trips ----------------
class TestTrips:
    def test_create_trip_credits_fre(self, api_client, base_url):
        payload = {
            "started_at": "2026-01-15T10:00:00Z",
            "ended_at": "2026-01-15T10:30:00Z",
            "distance_km": 25.0,
            "duration_min": 30.0,
            "avg_speed_kmh": 50.0,
            "max_speed_kmh": 70.0,
            "overspeed_count": 2,
            "route_name": "TEST_Route",
        }
        r = api_client.post(f"{base_url}/api/trips", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["fre_earned"] == 2.5  # 25/10
        trip = body["trip"]
        assert trip["distance_km"] == 25.0
        assert trip["safety_score"] == 90  # 100 - 2*5
        assert trip["route_name"] == "TEST_Route"
        # GET to verify persistence + balance increment
        prof = api_client.get(f"{base_url}/api/profile").json()
        assert prof["fre_balance"] == 2.5
        assert prof["total_distance_km"] == 25.0
        assert prof["total_trips"] == 1
        trips = api_client.get(f"{base_url}/api/trips").json()
        assert isinstance(trips, list) and len(trips) == 1
        assert trips[0]["id"] == trip["id"]

    def test_list_trips_isolated_per_device(self, api_client, base_url):
        # New device fixture per test -> empty list
        r = api_client.get(f"{base_url}/api/trips")
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Alerts ----------------
class TestAlerts:
    def test_create_alert_warning(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/alerts",
            json={"speed_kmh": 60.0, "limit_kmh": 50.0, "lat": 48.85, "lon": 2.35, "route_name": "TEST_Rue"},
        )
        assert r.status_code == 200
        a = r.json()
        assert a["excess_kmh"] == 10.0
        assert a["severity"] == "warning"
        assert a["route_name"] == "TEST_Rue"

    def test_create_alert_danger(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/alerts",
            json={"speed_kmh": 95.0, "limit_kmh": 80.0, "lat": 48.0, "lon": 2.0},
        )
        assert r.status_code == 200
        a = r.json()
        assert a["excess_kmh"] == 15.0
        assert a["severity"] == "danger"

    def test_list_alerts(self, api_client, base_url):
        api_client.post(
            f"{base_url}/api/alerts",
            json={"speed_kmh": 70, "limit_kmh": 50, "lat": 1.0, "lon": 2.0},
        )
        r = api_client.get(f"{base_url}/api/alerts")
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1


# ---------------- Rewards ----------------
class TestRewards:
    def test_rewards_empty(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/rewards")
        assert r.status_code == 200
        d = r.json()
        assert d["fre_balance"] == 0.0
        assert d["threshold"] == 1000.0
        assert d["wallet_ton"] is None
        assert d["events"] == []
        assert d["claims"] == []

    def test_claim_fails_without_wallet(self, api_client, base_url):
        # Earn some FRE first to ensure wallet is the blocker
        api_client.post(f"{base_url}/api/trips", json={
            "started_at": "2026-01-15T10:00:00Z",
            "ended_at": "2026-01-15T10:10:00Z",
            "distance_km": 5,
            "duration_min": 10,
            "avg_speed_kmh": 30,
            "max_speed_kmh": 40,
        })
        r = api_client.post(f"{base_url}/api/rewards/claim", json={"amount": 1000})
        assert r.status_code == 400
        assert "wallet" in r.json()["detail"].lower()

    def test_claim_fails_low_balance(self, api_client, base_url):
        # Set wallet but balance is 0
        api_client.put(f"{base_url}/api/profile", json={"wallet_ton": "EQTest_LowBal"})
        r = api_client.post(f"{base_url}/api/rewards/claim", json={"amount": 1000})
        assert r.status_code == 400
        assert "insuffisant" in r.json()["detail"].lower() or "1000" in r.json()["detail"]

    def test_claim_succeeds(self, api_client, base_url):
        # Set wallet
        api_client.put(f"{base_url}/api/profile", json={"wallet_ton": "EQTest_ClaimOk"})
        # Seed balance >= 1000: distance 10000 km -> 1000 FRE
        api_client.post(f"{base_url}/api/trips", json={
            "started_at": "2026-01-15T10:00:00Z",
            "ended_at": "2026-01-15T11:00:00Z",
            "distance_km": 10000.0,
            "duration_min": 60.0,
            "avg_speed_kmh": 100.0,
            "max_speed_kmh": 130.0,
        })
        before = api_client.get(f"{base_url}/api/profile").json()
        assert before["fre_balance"] >= 1000

        r = api_client.post(f"{base_url}/api/rewards/claim", json={"amount": 1000})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["amount"] == 1000
        assert c["wallet_ton"] == "EQTest_ClaimOk"
        assert c["tx_hash"].startswith("ton_")
        assert c["status"] == "confirmed"

        # Balance decremented
        after = api_client.get(f"{base_url}/api/profile").json()
        assert round(after["fre_balance"], 2) == round(before["fre_balance"] - 1000, 2)

        # Claim shows up in rewards
        rew = api_client.get(f"{base_url}/api/rewards").json()
        assert len(rew["claims"]) >= 1
        assert rew["claims"][0]["tx_hash"] == c["tx_hash"]


# ---------------- Speed limit (Overpass) ----------------
class TestSpeedLimit:
    def test_speed_limit_paris(self, api_client, base_url):
        # Place de la Concorde, Paris
        r = api_client.get(f"{base_url}/api/speed-limit", params={"lat": 48.8656, "lon": 2.3212})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "limit_kmh" in d
        assert isinstance(d["limit_kmh"], int)
        assert d["limit_kmh"] > 0
        assert "road_name" in d
        assert d["source"] in ("osm", "default", "fallback")

    def test_speed_limit_ocean_fallback(self, api_client, base_url):
        # Middle of Atlantic ocean -> no roads -> fallback
        r = api_client.get(f"{base_url}/api/speed-limit", params={"lat": 0.0, "lon": -30.0})
        assert r.status_code == 200
        d = r.json()
        assert d["limit_kmh"] == 50
        assert d["source"] == "fallback"

    def test_upcoming_limits(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/speed-limits/upcoming",
            params={"lat": 48.8656, "lon": 2.3212, "heading": 90},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "upcoming" in d
        assert len(d["upcoming"]) == 3
        dists = [x["distance_m"] for x in d["upcoming"]]
        assert dists == [500, 2000, 5000]
        for x in d["upcoming"]:
            assert isinstance(x["limit_kmh"], int) and x["limit_kmh"] > 0
