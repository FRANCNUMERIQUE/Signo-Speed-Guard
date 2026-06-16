"""Discord bot integration: send messages with buttons + handle interactions."""
import os
import logging
import httpx
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

logger = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"


def _env(name: str) -> str:
    return os.environ.get(name, "")


# Discord interaction types
INTERACTION_PING = 1
INTERACTION_MESSAGE_COMPONENT = 3
INTERACTION_MODAL_SUBMIT = 5

# Discord response types
RESPONSE_PONG = 1
RESPONSE_CHANNEL_MESSAGE = 4
RESPONSE_DEFERRED = 5
RESPONSE_UPDATE_MESSAGE = 7
RESPONSE_MODAL = 9


def verify_signature(signature: str, timestamp: str, body: bytes) -> bool:
    """Verify Discord ed25519 signature."""
    public_key = _env("DISCORD_PUBLIC_KEY")
    if not public_key:
        return False
    try:
        verify_key = VerifyKey(bytes.fromhex(public_key))
        verify_key.verify(timestamp.encode() + body, bytes.fromhex(signature))
        return True
    except (BadSignatureError, Exception) as e:
        logger.warning(f"Discord signature verify failed: {e}")
        return False


async def post_claim_notification(claim: dict) -> bool:
    """Post a Discord channel message with action buttons for a new claim."""
    bot_token = _env("DISCORD_BOT_TOKEN")
    channel_id = _env("DISCORD_CHANNEL_ID")
    if not bot_token or not channel_id:
        logger.info("Discord bot not configured, skipping notification")
        return False

    payload = {
        "embeds": [
            {
                "title": "🔔 Nouvelle réclamation $FRE",
                "description": f"**{claim['pseudo']}** demande un transfert de **{claim['amount']} FRE**",
                "color": 0x7A3CFF,
                "fields": [
                    {"name": "💰 Montant", "value": f"`{claim['amount']} FRE`", "inline": True},
                    {"name": "👤 Pseudo", "value": claim["pseudo"], "inline": True},
                    {"name": "🆔 Device", "value": f"`{claim['device_id'][:12]}...`", "inline": True},
                    {"name": "💳 Wallet TON", "value": f"```{claim['wallet_ton']}```", "inline": False},
                    {"name": "📋 Claim ID", "value": f"`{claim['id']}`", "inline": False},
                    {"name": "🕒 Demandé le", "value": claim["requested_at"], "inline": False},
                ],
                "footer": {"text": "Signo · Cliquez pour traiter cette demande"},
                "timestamp": claim["requested_at"],
            }
        ],
        "components": [
            {
                "type": 1,  # action row
                "components": [
                    {
                        "type": 2,  # button
                        "style": 3,  # green / success
                        "label": "✅ Marquer payée",
                        "custom_id": f"mark_paid:{claim['id']}",
                    },
                    {
                        "type": 2,
                        "style": 4,  # red / danger
                        "label": "❌ Refuser",
                        "custom_id": f"refuse:{claim['id']}",
                    },
                ],
            }
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.post(
                f"{DISCORD_API}/channels/{channel_id}/messages",
                json=payload,
                headers={"Authorization": f"Bot {bot_token}"},
            )
            if r.status_code >= 400:
                logger.warning(f"Discord post failed {r.status_code}: {r.text}")
                return False
            return True
    except Exception as e:
        logger.warning(f"Discord post error: {e}")
        return False


def build_modal_tx_hash(claim_id: str) -> dict:
    return {
        "type": RESPONSE_MODAL,
        "data": {
            "custom_id": f"submit_paid:{claim_id}",
            "title": "Marquer comme payée",
            "components": [
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 4,  # text input
                            "custom_id": "tx_hash",
                            "label": "Hash de transaction TON",
                            "style": 1,
                            "min_length": 1,
                            "max_length": 200,
                            "placeholder": "te6cckECxxx... ou ABCdef123...",
                            "required": True,
                        }
                    ],
                }
            ],
        },
    }


def build_modal_refuse(claim_id: str) -> dict:
    return {
        "type": RESPONSE_MODAL,
        "data": {
            "custom_id": f"submit_refuse:{claim_id}",
            "title": "Refuser la réclamation",
            "components": [
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 4,
                            "custom_id": "reason",
                            "label": "Motif du refus",
                            "style": 2,  # paragraph
                            "min_length": 3,
                            "max_length": 300,
                            "placeholder": "Ex. adresse TON invalide, suspicion de fraude...",
                            "required": True,
                        }
                    ],
                }
            ],
        },
    }


def get_modal_field(components: list, custom_id: str) -> str:
    """Walk modal submit components to extract a value by custom_id."""
    for row in components or []:
        for c in row.get("components", []):
            if c.get("custom_id") == custom_id:
                return c.get("value", "").strip()
    return ""


def text_response(content: str, ephemeral: bool = True) -> dict:
    return {
        "type": RESPONSE_CHANNEL_MESSAGE,
        "data": {"content": content, "flags": 64 if ephemeral else 0},
    }
