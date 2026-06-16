from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import httpx
import discord_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Signo API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------------- Models ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Profile(BaseModel):
    device_id: str
    name: str = "Conducteur"
    wallet_ton: Optional[str] = None
    fre_balance: float = 0.0
    total_distance_km: float = 0.0
    total_trips: int = 0
    safety_score: int = 100
    expo_push_token: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    wallet_ton: Optional[str] = None


class PushTokenRequest(BaseModel):
    token: str


class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    started_at: str
    ended_at: str
    distance_km: float
    duration_min: float
    avg_speed_kmh: float
    max_speed_kmh: float
    overspeed_count: int
    safety_score: int
    route_name: Optional[str] = None
    route_points: List[dict] = Field(default_factory=list)


class TripCreate(BaseModel):
    started_at: str
    ended_at: str
    distance_km: float
    duration_min: float
    avg_speed_kmh: float
    max_speed_kmh: float
    overspeed_count: int = 0
    route_name: Optional[str] = None
    route_points: List[dict] = Field(default_factory=list)


class Alert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    created_at: str = Field(default_factory=now_iso)
    speed_kmh: float
    limit_kmh: float
    excess_kmh: float
    lat: float
    lon: float
    route_name: Optional[str] = None
    severity: str = "warning"  # warning | danger


class AlertCreate(BaseModel):
    speed_kmh: float
    limit_kmh: float
    lat: float
    lon: float
    route_name: Optional[str] = None


class ClaimRequest(BaseModel):
    amount: float = 1000.0


class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    pseudo: str = "Conducteur"
    amount: float
    wallet_ton: str
    status: str = "pending"  # pending | paid | refused
    tx_hash: Optional[str] = None
    requested_at: str = Field(default_factory=now_iso)
    paid_at: Optional[str] = None
    refused_reason: Optional[str] = None


class ClaimAdminUpdate(BaseModel):
    status: str  # paid | refused
    tx_hash: Optional[str] = None
    refused_reason: Optional[str] = None


# ---------------- Helpers ----------------
async def get_or_create_profile(device_id: str) -> dict:
    doc = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    if doc:
        return doc
    profile = Profile(device_id=device_id).model_dump()
    await db.profiles.insert_one(profile.copy())
    doc = await db.profiles.find_one({"device_id": device_id}, {"_id": 0})
    return doc


def require_device(x_device_id: Optional[str]) -> str:
    if not x_device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-Id header")
    return x_device_id


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"app": "Signo API", "status": "ok"}


@api_router.get("/profile")
async def get_profile(x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    return await get_or_create_profile(device_id)


@api_router.put("/profile")
async def update_profile(payload: ProfileUpdate, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    await get_or_create_profile(device_id)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.profiles.update_one({"device_id": device_id}, {"$set": update})
    return await db.profiles.find_one({"device_id": device_id}, {"_id": 0})


@api_router.post("/profile/push-token")
async def save_push_token(payload: PushTokenRequest, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    await get_or_create_profile(device_id)
    await db.profiles.update_one(
        {"device_id": device_id}, {"$set": {"expo_push_token": payload.token}}
    )
    return {"ok": True}


async def send_push(token: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    """Send a push notification via Expo Push API (free, no auth)."""
    if not token or not token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                    "priority": "high",
                    "channelId": "default",
                },
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            if r.status_code >= 400:
                logger.warning(f"Push send failed {r.status_code}: {r.text}")
                return False
            return True
    except Exception as e:
        logger.warning(f"Push send error: {e}")
        return False


@api_router.post("/trips")
async def create_trip(payload: TripCreate, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    await get_or_create_profile(device_id)
    score = max(0, 100 - payload.overspeed_count * 5)
    trip = Trip(
        device_id=device_id,
        safety_score=score,
        **payload.model_dump(),
    )
    await db.trips.insert_one(trip.model_dump())

    # Reward calculation: 1 FRE per 10 km
    earned = round(payload.distance_km / 10.0, 2)
    await db.profiles.update_one(
        {"device_id": device_id},
        {
            "$inc": {
                "fre_balance": earned,
                "total_distance_km": payload.distance_km,
                "total_trips": 1,
            }
        },
    )
    if earned > 0:
        await db.reward_events.insert_one(
            {
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "trip_id": trip.id,
                "amount": earned,
                "reason": f"Trip {round(payload.distance_km, 1)} km",
                "created_at": now_iso(),
            }
        )
    return {"trip": trip.model_dump(), "fre_earned": earned}


@api_router.get("/trips")
async def list_trips(x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    docs = await db.trips.find({"device_id": device_id}, {"_id": 0}).sort("started_at", -1).to_list(500)
    return docs


@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    doc = await db.trips.find_one({"id": trip_id, "device_id": device_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Trip not found")
    return doc


@api_router.post("/alerts")
async def create_alert(payload: AlertCreate, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    excess = payload.speed_kmh - payload.limit_kmh
    severity = "danger" if excess >= 15 else "warning"
    alert = Alert(
        device_id=device_id,
        excess_kmh=round(excess, 1),
        severity=severity,
        **payload.model_dump(),
    )
    await db.alerts.insert_one(alert.model_dump())
    return alert.model_dump()


@api_router.get("/alerts")
async def list_alerts(x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    docs = await db.alerts.find({"device_id": device_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/rewards")
async def get_rewards(x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    profile = await get_or_create_profile(device_id)
    events = await db.reward_events.find({"device_id": device_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    claims = await db.claims.find({"device_id": device_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {
        "fre_balance": profile.get("fre_balance", 0.0),
        "threshold": 1000.0,
        "rate": "1 FRE / 10 km",
        "wallet_ton": profile.get("wallet_ton"),
        "events": events,
        "claims": claims,
    }


@api_router.post("/rewards/claim")
async def claim_rewards(payload: ClaimRequest, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    profile = await get_or_create_profile(device_id)

    # 1. Verify TON wallet is registered
    if not profile.get("wallet_ton"):
        raise HTTPException(
            status_code=400,
            detail="Aucune adresse TON n'est enregistrée. Veuillez renseigner votre adresse de réception dans votre profil avant d'effectuer une réclamation.",
        )

    # 2. Block duplicate pending claims
    existing = await db.claims.find_one(
        {"device_id": device_id, "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Une réclamation est déjà en attente de paiement.",
        )

    balance = profile.get("fre_balance", 0.0)
    if balance < 1000:
        raise HTTPException(
            status_code=400,
            detail=f"Solde insuffisant: {balance:.2f} FRE. Minimum 1000 FRE requis.",
        )

    amount = round(min(payload.amount, balance), 2)

    # 3. Atomically reserve the amount (prevent race condition / double spend)
    result = await db.profiles.update_one(
        {"device_id": device_id, "fre_balance": {"$gte": amount}},
        {"$inc": {"fre_balance": -amount}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Solde modifié, réessayez.")

    # 4. Save claim with status="pending"
    claim = Claim(
        device_id=device_id,
        pseudo=profile.get("name", "Conducteur"),
        amount=amount,
        wallet_ton=profile["wallet_ton"],
        status="pending",
    )
    await db.claims.insert_one(claim.model_dump())

    # 5. Notification — try bot (with buttons) first, fallback to legacy webhook
    notified = await discord_service.post_claim_notification(claim.model_dump())
    if not notified:
        webhook_url = os.environ.get("ADMIN_WEBHOOK_URL")
        if webhook_url:
            try:
                async with httpx.AsyncClient(timeout=6) as http:
                    await http.post(webhook_url, json={
                        "content": f"🔔 Claim {claim.id} · {claim.pseudo} · {claim.amount} FRE · {claim.wallet_ton}"
                    })
            except Exception as e:
                logger.warning(f"Webhook fallback failed: {e}")

    return {
        "ok": True,
        "claim": claim.model_dump(),
        "message": "Votre demande de paiement a bien été prise en compte. Le transfert sera effectué prochainement.",
    }


# ---- Admin: list pending + mark paid/refused ----
def _verify_admin(token: Optional[str]):
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@api_router.get("/admin/claims")
async def admin_list_claims(
    status: Optional[str] = None,
    x_admin_token: Optional[str] = Header(default=None),
):
    _verify_admin(x_admin_token)
    q = {}
    if status:
        q["status"] = status
    docs = await db.claims.find(q, {"_id": 0}).sort("requested_at", -1).to_list(500)
    return docs


@api_router.patch("/admin/claims/{claim_id}")
async def admin_update_claim(
    claim_id: str,
    payload: ClaimAdminUpdate,
    x_admin_token: Optional[str] = Header(default=None),
):
    _verify_admin(x_admin_token)
    doc = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Claim not found")
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Claim already {doc['status']}")

    update = {"status": payload.status}
    if payload.status == "paid":
        update["paid_at"] = now_iso()
        if payload.tx_hash:
            update["tx_hash"] = payload.tx_hash
    elif payload.status == "refused":
        update["refused_reason"] = payload.refused_reason or "Refusée"
        # Refund the FRE balance to the user
        await db.profiles.update_one(
            {"device_id": doc["device_id"]},
            {"$inc": {"fre_balance": doc["amount"]}},
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db.claims.update_one({"id": claim_id}, {"$set": update})
    return await db.claims.find_one({"id": claim_id}, {"_id": 0})


# ---------------- Speed limit via Overpass API ----------------
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _parse_maxspeed(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    raw = raw.strip().lower()
    if raw in ("none", "signals", "variable"):
        return None
    # eg "50", "50 mph", "FR:urban"
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        # tag-style implicit limits
        if "urban" in raw:
            return 50
        if "rural" in raw:
            return 80
        if "motorway" in raw:
            return 130
        return None
    val = int(digits)
    if "mph" in raw:
        val = round(val * 1.60934)
    return val


def _highway_default(highway: Optional[str]) -> int:
    mapping = {
        "motorway": 130,
        "motorway_link": 110,
        "trunk": 110,
        "trunk_link": 90,
        "primary": 80,
        "primary_link": 70,
        "secondary": 80,
        "secondary_link": 70,
        "tertiary": 70,
        "tertiary_link": 50,
        "residential": 50,
        "living_street": 20,
        "service": 30,
        "unclassified": 50,
    }
    return mapping.get(highway or "", 50)


@api_router.get("/speed-limit")
async def speed_limit(lat: float, lon: float):
    """Find nearest road maxspeed via Overpass + road name via Nominatim (more reliable)."""
    query = f"""
    [out:json][timeout:8];
    way(around:40,{lat},{lon})[highway];
    out tags;
    """
    headers = {"User-Agent": "Signo/1.0 (driver-assistance)", "Accept": "application/json"}
    limit = 50
    highway = None
    osm_source = False
    osm_name = None

    # ---- Overpass: maxspeed + highway type (+ name if available) ----
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as http:
            try:
                r = await http.post(OVERPASS_URL, content=query, headers={"Content-Type": "text/plain"})
                if r.status_code == 406:
                    r = await http.post(OVERPASS_URL, data={"data": query})
                r.raise_for_status()
                data = r.json()
                elements = data.get("elements", [])
                if elements:
                    el = next((e for e in elements if e.get("tags", {}).get("maxspeed")), elements[0])
                    tags = el.get("tags", {})
                    raw = tags.get("maxspeed")
                    highway = tags.get("highway")
                    limit = _parse_maxspeed(raw) or _highway_default(highway)
                    osm_source = bool(raw)
                    for e in elements:
                        t = e.get("tags", {})
                        if t.get("name"):
                            osm_name = t["name"]
                            if t.get("ref"):
                                osm_name = f"{t['ref']} · {t['name']}"
                            break
                        if t.get("ref") and not osm_name:
                            osm_name = t["ref"]
            except Exception as e:
                logger.warning(f"Overpass error: {e}")
    except Exception as e:
        logger.warning(f"Overpass client error: {e}")

    # ---- Nominatim reverse geocoding fallback for road name ----
    nomi_name = None
    if not osm_name:
        try:
            nomi_url = (
                f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}"
                "&format=json&zoom=17&addressdetails=1&accept-language=fr"
            )
            async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "Signo/1.0 (https://signo.app)"}) as http:
                r = await http.get(nomi_url)
                r.raise_for_status()
                nj = r.json()
                addr = nj.get("address", {}) or {}
                nomi_name = (
                    addr.get("road")
                    or addr.get("pedestrian")
                    or addr.get("footway")
                    or addr.get("cycleway")
                    or addr.get("path")
                    or addr.get("residential")
                    or addr.get("street")
                    or addr.get("suburb")
                    or addr.get("neighbourhood")
                    or addr.get("village")
                    or addr.get("town")
                    or addr.get("city")
                )
        except Exception as e:
            logger.warning(f"Nominatim error: {e}")

    name = osm_name or nomi_name
    if not name:
        labels = {
            "motorway": "Autoroute",
            "trunk": "Voie rapide",
            "primary": "Route principale",
            "secondary": "Route secondaire",
            "tertiary": "Route locale",
            "residential": "Rue résidentielle",
            "living_street": "Zone de rencontre",
            "service": "Voie de service",
            "unclassified": "Route locale",
            "footway": "Voie piétonne",
            "cycleway": "Piste cyclable",
        }
        name = labels.get(highway or "", "Route locale")

    return {
        "limit_kmh": limit,
        "road_name": name,
        "highway": highway,
        "source": "osm" if osm_source else "default",
        "updated_at": now_iso(),
    }


@api_router.get("/speed-limits/upcoming")
async def upcoming_limits(lat: float, lon: float, heading: float = 0.0):
    """Return upcoming speed limits ahead of the user along heading.
    Probes 2 points: 500m, 2km using Overpass."""
    distances = [500, 2000]
    results = []

    def offset(lat_, lon_, dist_m, bearing_deg):
        R = 6378137.0
        br = math.radians(bearing_deg)
        lat_r = math.radians(lat_)
        lon_r = math.radians(lon_)
        new_lat = math.asin(math.sin(lat_r) * math.cos(dist_m / R) + math.cos(lat_r) * math.sin(dist_m / R) * math.cos(br))
        new_lon = lon_r + math.atan2(
            math.sin(br) * math.sin(dist_m / R) * math.cos(lat_r),
            math.cos(dist_m / R) - math.sin(lat_r) * math.sin(new_lat),
        )
        return math.degrees(new_lat), math.degrees(new_lon)

    headers = {"User-Agent": "Signo/1.0 (driver-assistance)", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as http:
            for d in distances:
                p_lat, p_lon = offset(lat, lon, d, heading)
                q = f"""
                [out:json][timeout:6];
                way(around:40,{p_lat},{p_lon})[highway];
                out tags 1;
                """
                limit = 50
                # try content first, then form-encoded fallback if 406
                try:
                    r = await http.post(OVERPASS_URL, content=q, headers={"Content-Type": "text/plain"})
                    if r.status_code == 406:
                        r = await http.post(OVERPASS_URL, data={"data": q})
                    r.raise_for_status()
                    js = r.json()
                    els = js.get("elements", [])
                    if els:
                        tags = els[0].get("tags", {})
                        limit = _parse_maxspeed(tags.get("maxspeed")) or _highway_default(tags.get("highway"))
                except Exception:
                    pass
                results.append({"distance_m": d, "limit_kmh": limit})
    except Exception as e:
        logger.warning(f"Upcoming error: {e}")
        results = [
            {"distance_m": 500, "limit_kmh": 50},
            {"distance_m": 2000, "limit_kmh": 80},
        ]

    return {"upcoming": results, "updated_at": now_iso()}


# ---------------- Weather (Open-Meteo, free, no API key) ----------------
WEATHER_CODES = {
    0: ("Ensoleillé", "sunny"),
    1: ("Peu nuageux", "partly-sunny"),
    2: ("Partiellement nuageux", "partly-sunny"),
    3: ("Nuageux", "cloud"),
    45: ("Brouillard", "cloud-outline"),
    48: ("Brouillard givrant", "cloud-outline"),
    51: ("Bruine légère", "rainy-outline"),
    53: ("Bruine", "rainy-outline"),
    55: ("Bruine dense", "rainy"),
    61: ("Pluie faible", "rainy"),
    63: ("Pluie", "rainy"),
    65: ("Pluie forte", "rainy"),
    71: ("Neige faible", "snow"),
    73: ("Neige", "snow"),
    75: ("Neige forte", "snow"),
    80: ("Averses", "rainy"),
    81: ("Averses fortes", "rainy"),
    82: ("Averses violentes", "thunderstorm"),
    95: ("Orage", "thunderstorm"),
    96: ("Orage + grêle", "thunderstorm"),
    99: ("Orage violent", "thunderstorm"),
}


@api_router.get("/weather")
async def weather(lat: float, lon: float):
    url = (
        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,weather_code,wind_speed_10m,precipitation"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"Weather error: {e}")
        return {
            "temp_c": None,
            "code": None,
            "label": "Indisponible",
            "icon": "cloud-outline",
            "wind_kmh": None,
            "precip_mm": None,
            "updated_at": now_iso(),
        }
    cur = data.get("current", {})
    code = cur.get("weather_code", 0)
    label, icon = WEATHER_CODES.get(code, ("Conditions inconnues", "cloud-outline"))
    return {
        "temp_c": cur.get("temperature_2m"),
        "code": code,
        "label": label,
        "icon": icon,
        "wind_kmh": cur.get("wind_speed_10m"),
        "precip_mm": cur.get("precipitation"),
        "updated_at": now_iso(),
    }


# ---------------- Danger Zones (community signaling) ----------------
class DangerZoneCreate(BaseModel):
    lat: float
    lon: float
    type: str = "hazard"  # accident | police | hazard | speed_camera | construction
    note: Optional[str] = None


class DangerZone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    lat: float
    lon: float
    type: str
    note: Optional[str] = None
    confirmations: int = 1
    created_at: str = Field(default_factory=now_iso)


DANGER_TYPES_LABELS = {
    "accident": "Accident",
    "police": "Police / Contrôle",
    "hazard": "Obstacle / Danger",
    "speed_camera": "Radar",
    "construction": "Travaux",
}


@api_router.post("/danger-zones")
async def create_danger(payload: DangerZoneCreate, x_device_id: Optional[str] = Header(default=None)):
    device_id = require_device(x_device_id)
    zone = DangerZone(device_id=device_id, **payload.model_dump())
    await db.danger_zones.insert_one(zone.model_dump())
    out = zone.model_dump()
    out["label"] = DANGER_TYPES_LABELS.get(out["type"], "Danger")
    return out


@api_router.get("/danger-zones")
async def list_danger(lat: float, lon: float, radius_km: float = 10.0):
    d = radius_km / 111.0
    cursor = db.danger_zones.find(
        {
            "lat": {"$gte": lat - d, "$lte": lat + d},
            "lon": {"$gte": lon - d, "$lte": lon + d},
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(100)
    zones = await cursor.to_list(100)
    for z in zones:
        z["label"] = DANGER_TYPES_LABELS.get(z.get("type", ""), "Danger")
    return zones




# ---------------- Discord Interactions Endpoint ----------------
from fastapi import Request, Response


@api_router.post("/discord/interactions")
async def discord_interactions(request: Request):
    signature = request.headers.get("X-Signature-Ed25519", "")
    timestamp = request.headers.get("X-Signature-Timestamp", "")
    body = await request.body()

    if not discord_service.verify_signature(signature, timestamp, body):
        return Response(content="invalid request signature", status_code=401)

    interaction = await request.json()
    itype = interaction.get("type")

    # PING — Discord handshake
    if itype == discord_service.INTERACTION_PING:
        return {"type": discord_service.RESPONSE_PONG}

    # Button click
    if itype == discord_service.INTERACTION_MESSAGE_COMPONENT:
        custom_id = interaction.get("data", {}).get("custom_id", "")
        if custom_id.startswith("mark_paid:"):
            claim_id = custom_id.split(":", 1)[1]
            return discord_service.build_modal_tx_hash(claim_id)
        if custom_id.startswith("refuse:"):
            claim_id = custom_id.split(":", 1)[1]
            return discord_service.build_modal_refuse(claim_id)

    # Modal submit
    if itype == discord_service.INTERACTION_MODAL_SUBMIT:
        custom_id = interaction.get("data", {}).get("custom_id", "")
        components = interaction.get("data", {}).get("components", [])
        if custom_id.startswith("submit_paid:"):
            claim_id = custom_id.split(":", 1)[1]
            tx_hash = discord_service.get_modal_field(components, "tx_hash")
            doc = await db.claims.find_one({"id": claim_id}, {"_id": 0})
            if not doc:
                return discord_service.text_response(f"❌ Claim `{claim_id}` introuvable.")
            if doc["status"] != "pending":
                return discord_service.text_response(f"⚠️ Claim déjà `{doc['status']}`.")
            await db.claims.update_one(
                {"id": claim_id},
                {"$set": {"status": "paid", "paid_at": now_iso(), "tx_hash": tx_hash}},
            )
            # Push notification to user
            user = await db.profiles.find_one({"device_id": doc["device_id"]}, {"_id": 0})
            if user and user.get("expo_push_token"):
                await send_push(
                    user["expo_push_token"],
                    "💸 Paiement $FRE reçu !",
                    f"Votre réclamation de {doc['amount']} FRE a été payée vers votre wallet TON.",
                    data={"type": "claim_paid", "claim_id": claim_id, "tx_hash": tx_hash},
                )
            return discord_service.text_response(
                f"✅ Claim **{doc['amount']} FRE** marqué payé.\n"
                f"👤 {doc['pseudo']}\n"
                f"💳 `{doc['wallet_ton']}`\n"
                f"🔗 tx : `{tx_hash}`",
                ephemeral=False,
            )
        if custom_id.startswith("submit_refuse:"):
            claim_id = custom_id.split(":", 1)[1]
            reason = discord_service.get_modal_field(components, "reason")
            doc = await db.claims.find_one({"id": claim_id}, {"_id": 0})
            if not doc:
                return discord_service.text_response(f"❌ Claim `{claim_id}` introuvable.")
            if doc["status"] != "pending":
                return discord_service.text_response(f"⚠️ Claim déjà `{doc['status']}`.")
            await db.claims.update_one(
                {"id": claim_id},
                {"$set": {"status": "refused", "refused_reason": reason}},
            )
            await db.profiles.update_one(
                {"device_id": doc["device_id"]},
                {"$inc": {"fre_balance": doc["amount"]}},
            )
            # Push notification to user
            user = await db.profiles.find_one({"device_id": doc["device_id"]}, {"_id": 0})
            if user and user.get("expo_push_token"):
                await send_push(
                    user["expo_push_token"],
                    "❌ Réclamation refusée",
                    f"Votre demande de {doc['amount']} FRE a été refusée. Motif : {reason}. Le solde a été remboursé.",
                    data={"type": "claim_refused", "claim_id": claim_id, "reason": reason},
                )
            return discord_service.text_response(
                f"❌ Claim **{doc['amount']} FRE** refusé.\n"
                f"👤 {doc['pseudo']} — solde remboursé\n"
                f"📝 Motif : {reason}",
                ephemeral=False,
            )

    return {"type": discord_service.RESPONSE_PONG}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
