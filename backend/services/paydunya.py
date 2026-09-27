
"""
PayDunya payment service for Amanah Giving.

This module isolates PayDunya integration from the FastAPI routers.
Secrets are loaded from core.config and are never logged.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import paydunya

from core.config import settings


class PayDunyaError(Exception):
    """Raised when a PayDunya operation fails."""


@dataclass
class PayDunyaCheckout:
    """Normalized PayDunya checkout response."""

    success: bool
    checkout_url: str | None = None
    token: str | None = None
    response_code: str | None = None
    response_text: str | None = None
    raw_response: Any = None


def initialize_paydunya() -> None:
    """
    Configure the PayDunya SDK using environment-backed settings.

    The SDK expects the master key, private key and token.
    The public key is kept in our application configuration for
    future provider features.
    """

    if not settings.paydunya_master_key:
        raise PayDunyaError("PAYDUNYA_MASTER_KEY is not configured.")

    if not settings.paydunya_private_key:
        raise PayDunyaError("PAYDUNYA_PRIVATE_KEY is not configured.")

    if not settings.paydunya_token:
        raise PayDunyaError("PAYDUNYA_TOKEN is not configured.")

    paydunya.api_keys = {
        "PAYDUNYA-MASTER-KEY": settings.paydunya_master_key,
        "PAYDUNYA-PRIVATE-KEY": settings.paydunya_private_key,
        "PAYDUNYA-TOKEN": settings.paydunya_token,
    }

    # En mode test, le SDK doit utiliser l'environnement sandbox.
    # En production, PAYDUNYA_MODE doit être "live".
    paydunya.debug = settings.paydunya_mode.lower() == "test"


def create_checkout(
    *,
    amount: int,
    description: str,
    customer_name: str | None = None,
    customer_email: str | None = None,
    customer_phone: str | None = None,
    return_url: str | None = None,
    cancel_url: str | None = None,
) -> PayDunyaCheckout:
    """
    Create a PayDunya Checkout Invoice.

    The customer is redirected to PayDunya where the available
    payment methods can be selected.
    """

    if amount <= 0:
        raise PayDunyaError("Payment amount must be greater than zero.")

    initialize_paydunya()

    store = paydunya.Store(
        name="Amanah Giving",
        tagline="Plateforme de dons et de collecte solidaire",
        website_url=settings.frontend_url,
    )

    invoice = paydunya.Invoice(store)
    invoice.description = description
    invoice.total_amount = amount

    # ---------------------------------------------------------
    # IPN callback
    # ---------------------------------------------------------
    # PayDunya appellera cette URL après le changement d'état
    # du paiement.
    if settings.paydunya_callback_url:
        try:
            invoice.callback_url = settings.paydunya_callback_url
        except AttributeError:
            pass

    # ---------------------------------------------------------
    # Informations client
    # ---------------------------------------------------------
    if customer_name:
        invoice.add_custom_data(
            [
                ("customer_name", customer_name),
            ]
        )

    if customer_email:
        invoice.add_custom_data(
            [
                ("customer_email", customer_email),
            ]
        )

    if customer_phone:
        invoice.add_custom_data(
            [
                ("customer_phone", customer_phone),
            ]
        )

    # ---------------------------------------------------------
    # Return URL
    # ---------------------------------------------------------
    if return_url:
        try:
            invoice.return_url = return_url
        except AttributeError:
            pass

    # ---------------------------------------------------------
    # Cancel URL
    # ---------------------------------------------------------
    if cancel_url:
        try:
            invoice.cancel_url = cancel_url
        except AttributeError:
            pass

    # ---------------------------------------------------------
    # Création de la facture PayDunya
    # ---------------------------------------------------------
    try:
        successful, response = invoice.create()
    except Exception as exc:
        raise PayDunyaError(
            f"PayDunya checkout creation failed: {exc}"
        ) from exc

    if not successful:
        response_code = None
        response_text = None

        if isinstance(response, dict):
            response_code = response.get("response_code")
            response_text = response.get("response_text")

        raise PayDunyaError(
            f"PayDunya rejected the checkout request. "
            f"code={response_code}, message={response_text}"
        )

    # ---------------------------------------------------------
    # Normalisation de la réponse
    # ---------------------------------------------------------
    response_code = None
    response_text = None
    checkout_url = None
    token = None

    if isinstance(response, dict):
        response_code = response.get("response_code")
        response_text = response.get("response_text")

        # Le SDK PayDunya retourne actuellement l'URL du checkout
        # dans response_text.
        checkout_url = response.get("response_text")

        token = response.get("token")

    return PayDunyaCheckout(
        success=True,
        checkout_url=checkout_url,
        token=token,
        response_code=response_code,
        response_text=response_text,
        raw_response=response,
    )
