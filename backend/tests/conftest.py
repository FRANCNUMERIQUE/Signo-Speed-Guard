import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load backend .env so we can do post-test DB cleanup
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# Fallback to frontend env
if not BASE_URL:
    fe_env = Path(__file__).resolve().parent.parent.parent / "frontend" / ".env"
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL is required"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture()
def device_id():
    return f"TEST_{uuid.uuid4().hex[:12]}"


@pytest.fixture()
def api_client(device_id):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Device-Id": device_id})
    return s


@pytest.fixture()
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def pytest_sessionfinish(session, exitstatus):
    """Cleanup all TEST_ device data from Mongo after run."""
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            return
        c = MongoClient(mongo_url)
        db = c[db_name]
        for coll in ("profiles", "trips", "alerts", "reward_events", "claims", "danger_zones"):
            db[coll].delete_many({"device_id": {"$regex": "^TEST_"}})
        c.close()
    except Exception as e:
        print(f"cleanup warning: {e}")
