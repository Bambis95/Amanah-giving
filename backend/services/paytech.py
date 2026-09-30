"""
PayTech payment service (Wave, Orange Money, Free Money, card) — https://paytech.sn

The donor is sent to the PayTech checkout page; PayTech then notifies the IPN URL. Only the
IPN, authenticated by its HMAC, marks a donation as paid. Keys come from core.config and are
never logged.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any, Mapping

import httpx

from core.config import settings

REQUEST_URL = "https://paytech.sn/api/payment/request-payment"

# Our payment methods and PayTech's names for them (target_payment)
TARGET_PAYMENT = {
    "wave": "Wave",
    "orange_money": "Orange Money",
    "card": "Carte Bancaire",
    "stripe": "Carte Bancaire",
}


class PayTechError(Exception):
    """Raised when a PayTech operation fails."""


@dataclass
class PayTechCheckout:
    token: str
    redirect_url: str


def configured() -> bool:
    return bool(settings.paytech_api_key and settings.paytech_api_secret)


async def create_payment(
    *,
    amount: int,
    ref_command: str,
    item_name: str,
    command_name: str,
    success_url: str,
    cancel_url: str,
    payment_method: str | None = None,
    custom_field: dict[str, Any] | None = None,
) -> PayTechCheckout:
    """Request a PayTech checkout page for one donation."""
    if amount <= 0:
        raise PayTechError("Payment amount must be greater than zero.")
    if not configured():
        raise PayTechError("PAYTECH_API_KEY / PAYTECH_API_SECRET are not configured.")

    body: dict[str, Any] = {
        "item_name": item_name,
        "item_price": amount,
        "currency": "XOF",
        "ref_command": ref_command,
        "command_name": command_name,
        "env": "prod" if settings.paytech_env.lower() == "prod" else "test",
        "success_url": success_url,
        "cancel_url": cancel_url,
    }
    if settings.paytech_ipn_url:
        body["ipn_url"] = settings.paytech_ipn_url
    target = TARGET_PAYMENT.get(payment_method or "")
    if target:
        body["target_payment"] = target
    if custom_field:
        body["custom_field"] = json.dumps(custom_field)

    headers = {
        "API_KEY": settings.paytech_api_key,
        "API_SECRET": settings.paytech_api_secret,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(REQUEST_URL, json=body, headers=headers)
        data = response.json()
    except Exception as exc:
        raise PayTechError(f"PayTech request failed: {type(exc).__name__}") from exc

    if not isinstance(data, dict):
        raise PayTechError(f"PayTech returned an unexpected answer (HTTP {response.status_code})")
    token = data.get("token")
    redirect_url = data.get("redirect_url") or data.get("redirectUrl")
    if response.status_code != 200 or str(data.get("success")) != "1" or not token or not redirect_url:
        message = data.get("message") or data.get("error")
        raise PayTechError(f"PayTech rejected the payment request (HTTP {response.status_code}): {message}")
    return PayTechCheckout(token=str(token), redirect_url=str(redirect_url))


def ipn_is_authentic(fields: Mapping[str, str]) -> bool:
    """Check that a notification really comes from PayTech with our keys.

    Recommended method: hmac_compute = HMAC-SHA256("final_item_price|ref_command|api_key", api_secret),
    computed on the values exactly as received. Older notifications carry only the SHA-256 of both keys.
    """
    if not configured():
        return False
    key = settings.paytech_api_key
    secret = settings.paytech_api_secret

    received_hmac = str(fields.get("hmac_compute") or "")
    if received_hmac:
        message = f"{fields.get('final_item_price', '')}|{fields.get('ref_command', '')}|{key}"
        expected = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(received_hmac.lower(), expected)

    key_hash = str(fields.get("api_key_sha256") or "")
    secret_hash = str(fields.get("api_secret_sha256") or "")
    if not key_hash or not secret_hash:
        return False
    return hmac.compare_digest(key_hash.lower(), hashlib.sha256(key.encode("utf-8")).hexdigest()) and hmac.compare_digest(
        secret_hash.lower(), hashlib.sha256(secret.encode("utf-8")).hexdigest()
    )
