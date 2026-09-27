import hashlib
import hmac
import json
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.projects import Projects

from core.config import settings
from core.database import get_db
from services.payment import PaymentService, CheckoutSessionRequest, CheckoutError
from services.donations import DonationsService
from services.paydunya import create_checkout, PayDunyaError
from services.email import prepare_donation_confirmation, send_email
from dependencies.auth import get_optional_user
from schemas.auth import UserResponse


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/payment",
    tags=["payment"],
)


# =============================================================
# REQUEST / RESPONSE MODELS
# =============================================================

class CreateDonationCheckoutRequest(BaseModel):
    """Request to create a checkout session for a donation."""

    amount: int
    cause: str
    payment_method: str
    project_id: Optional[int] = None
    donor_first_name: Optional[str] = None
    donor_last_name: Optional[str] = None
    donor_email: Optional[EmailStr] = None
    donor_phone: Optional[str] = None
    message: Optional[str] = None


class CreateDonationCheckoutResponse(BaseModel):
    """Response containing checkout information."""

    checkout_url: Optional[str] = None
    session_id: Optional[str] = None
    donation_id: Optional[int] = None
    payment_method: str
    instructions: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    """Request to verify a Stripe payment."""

    session_id: str


class VerifyPaymentResponse(BaseModel):
    """Response with payment verification result."""

    status: str
    payment_status: str
    donation_id: Optional[int] = None
    amount: Optional[int] = None


# =============================================================
# PROJECT CREDIT
# =============================================================

async def credit_project(db: AsyncSession, donation) -> None:
    """Add a newly paid donation to its project's totals (Stripe and PayDunya).

    Callers invoke it only on the first transition to "paid". The increment runs
    in SQL so two payments confirmed at the same time cannot overwrite each other.
    """
    if not donation.project_id:
        return

    result = await db.execute(
        update(Projects)
        .where(Projects.id == donation.project_id)
        .values(
            raised=func.coalesce(Projects.raised, 0) + donation.amount,
            donors=func.coalesce(Projects.donors, 0) + 1,
        )
    )
    await db.commit()

    if result.rowcount == 0:
        logger.warning(
            "Project %s not found for donation %s",
            donation.project_id,
            donation.id,
        )


# =============================================================
# CREATE DONATION CHECKOUT
# =============================================================

@router.post(
    "/create-checkout",
    response_model=CreateDonationCheckoutResponse,
)
async def create_donation_checkout(
    data: CreateDonationCheckoutRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a donation checkout using Stripe or PayDunya (account optional)."""

    # Anonymous donors are allowed: the donation then has no owner
    user_id = str(current_user.id) if current_user else None

    logger.info(
        "Creating donation checkout: amount=%s, method=%s",
        data.amount,
        data.payment_method,
    )

    # ---------------------------------------------------------
    # VALIDATION
    # ---------------------------------------------------------

    if data.amount < 500:
        raise HTTPException(
            status_code=400,
            detail="Le montant minimum est de 500 FCFA",
        )

    # Without an account, the email is the only way to reach the donor
    if not current_user and not data.donor_email:
        raise HTTPException(
            status_code=400,
            detail="L'email est obligatoire pour un don sans compte.",
        )

    # A targeted project must exist and still accept donations;
    # its category becomes the donation's cause.
    if data.project_id is not None:
        project = await db.get(Projects, data.project_id)
        if not project:
            raise HTTPException(
                status_code=400,
                detail="Ce projet n'existe pas.",
            )
        if project.status not in (None, "active"):
            raise HTTPException(
                status_code=400,
                detail="Ce projet n'accepte plus de dons.",
            )
        data.cause = project.category

    allowed_methods = {
        "card",
        "stripe",
        "wave",
        "orange_money",
    }

    if data.payment_method not in allowed_methods:
        raise HTTPException(
            status_code=400,
            detail=(
                "Méthode de paiement invalide. "
                "Utilisez card, stripe, wave ou orange_money."
            ),
        )

    donations_service = DonationsService(db)

    # =========================================================
    # STRIPE
    # =========================================================

    if data.payment_method in ("card", "stripe"):

        payment_service = PaymentService()

        amount_eur = round(data.amount / 656, 2)

        if amount_eur < 0.50:
            amount_eur = 0.50

        try:
            frontend_url = getattr(
                settings,
                "frontend_url",
                "http://localhost:5173",
            )

            checkout_request = CheckoutSessionRequest(
                amount=amount_eur,
                currency="eur",
                mode="payment",
                ui_mode="hosted",
                success_url=(
                    f"{frontend_url}"
                    "/payment/success"
                    "?session_id={CHECKOUT_SESSION_ID}"
                ),
                cancel_url=f"{frontend_url}/payment/cancel",
                metadata={
                    "cause": data.cause,
                    "amount_fcfa": str(data.amount),
                    "donor_email": data.donor_email or "",
                    "donor_name": (
                        f"{data.donor_first_name or ''} "
                        f"{data.donor_last_name or ''}"
                    ).strip(),
                },
            )

            response = await payment_service.create_checkout_session(
                checkout_request
            )

            donation_data = {
                "amount": data.amount,
                "cause": data.cause,
                "payment_method": "stripe",
                "payment_status": "pending",
                "payment_provider": "stripe",
                "payment_reference": response.session_id,
                "stripe_session_id": response.session_id,
                "project_id": data.project_id,
                "donor_first_name": data.donor_first_name,
                "donor_last_name": data.donor_last_name,
                "donor_email": data.donor_email,
                "donor_phone": data.donor_phone,
                "message": data.message,
            }

            donation = await donations_service.create(
                donation_data,
                user_id=user_id,
            )

            return CreateDonationCheckoutResponse(
                checkout_url=response.url,
                session_id=response.session_id,
                donation_id=donation.id if donation else None,
                payment_method="stripe",
            )

        except CheckoutError as exc:
            logger.error(
                "Stripe checkout error: %s",
                str(exc),
            )

            raise HTTPException(
                status_code=500,
                detail=f"Erreur de paiement Stripe: {str(exc)}",
            ) from exc

    # =========================================================
    # PAYDUNYA - WAVE / ORANGE MONEY
    # =========================================================

    if data.payment_method in ("wave", "orange_money"):

        # -----------------------------------------------------
        # 1. Créer d'abord le don en statut pending
        # -----------------------------------------------------

        donation_data = {
            "amount": data.amount,
            "cause": data.cause,
            "payment_method": data.payment_method,
            "payment_status": "pending",
            "payment_provider": "paydunya",
            "project_id": data.project_id,
            "donor_first_name": data.donor_first_name,
            "donor_last_name": data.donor_last_name,
            "donor_email": data.donor_email,
            "donor_phone": data.donor_phone,
            "message": data.message,
        }

        try:
            donation = await donations_service.create(
                donation_data,
                user_id=user_id,
            )

        except Exception as exc:
            logger.exception(
                "Failed to create donation before PayDunya checkout"
            )

            raise HTTPException(
                status_code=500,
                detail="Impossible de créer le don.",
            ) from exc

        if not donation:
            raise HTTPException(
                status_code=500,
                detail="Le don n'a pas pu être créé.",
            )

        # -----------------------------------------------------
        # 2. Création de la facture PayDunya
        # -----------------------------------------------------

        method_name = (
            "Wave"
            if data.payment_method == "wave"
            else "Orange Money"
        )

        donor_name = (
            f"{data.donor_first_name or ''} "
            f"{data.donor_last_name or ''}"
        ).strip()

        frontend_url = getattr(
            settings,
            "frontend_url",
            "http://localhost:5173",
        )

        return_url = (
            f"{frontend_url}/payment/success"
            f"?donation_id={donation.id}"
            f"&provider=paydunya"
        )

        cancel_url = (
            f"{frontend_url}/payment/cancel"
            f"?donation_id={donation.id}"
        )

        try:
            checkout = create_checkout(
                amount=data.amount,
                description=(
                    f"Don Amanah Giving #{donation.id} - "
                    f"{method_name}"
                ),
                customer_name=donor_name or None,
                customer_email=data.donor_email,
                customer_phone=data.donor_phone,
                return_url=return_url,
                cancel_url=cancel_url,
            )

        except PayDunyaError as exc:
            logger.error(
                "PayDunya checkout error for donation %s: %s",
                donation.id,
                str(exc),
            )

            try:
                await donations_service.update(
                    donation.id,
                    {
                        "payment_status": "failed",
                    },
                    user_id=user_id,
                )
            except Exception:
                logger.exception(
                    "Failed to mark donation %s as failed",
                    donation.id,
                )

            raise HTTPException(
                status_code=502,
                detail=f"Erreur PayDunya: {str(exc)}",
            ) from exc

        # -----------------------------------------------------
        # 3. Vérifier la réponse PayDunya
        # -----------------------------------------------------

        if not checkout.success or not checkout.checkout_url:
            logger.error(
                "PayDunya returned an invalid checkout for donation %s",
                donation.id,
            )

            try:
                await donations_service.update(
                    donation.id,
                    {
                        "payment_status": "failed",
                    },
                    user_id=user_id,
                )
            except Exception:
                logger.exception(
                    "Failed to update failed PayDunya donation"
                )

            raise HTTPException(
                status_code=502,
                detail=(
                    "PayDunya n'a pas retourné "
                    "d'URL de paiement valide."
                ),
            )

        # -----------------------------------------------------
        # 4. Vérifier la présence du token
        # -----------------------------------------------------

        if not checkout.token:
            logger.error(
                "PayDunya checkout has no token for donation %s",
                donation.id,
            )

            try:
                await donations_service.update(
                    donation.id,
                    {
                        "payment_status": "failed",
                    },
                    user_id=user_id,
                )
            except Exception:
                logger.exception(
                    "Failed to update donation after missing token"
                )

            raise HTTPException(
                status_code=502,
                detail=(
                    "PayDunya n'a pas retourné "
                    "de token de paiement valide."
                ),
            )

        # -----------------------------------------------------
        # 5. Sauvegarder les informations PayDunya
        # -----------------------------------------------------

        payment_reference = checkout.token

        updated_donation = await donations_service.update(
            donation.id,
            {
                "payment_provider": "paydunya",
                "payment_reference": payment_reference,
                "payment_checkout_url": checkout.checkout_url,
                "paydunya_token": checkout.token,
                "payment_status": "pending",
            },
            user_id=user_id,
        )

        if not updated_donation:
            logger.error(
                "Failed to update PayDunya donation %s",
                donation.id,
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Impossible d'enregistrer "
                    "les informations PayDunya."
                ),
            )

        logger.info(
            "PayDunya checkout created successfully: "
            "donation_id=%s token=%s method=%s",
            donation.id,
            checkout.token,
            data.payment_method,
        )

        # -----------------------------------------------------
        # 6. Retourner l'URL au frontend
        # -----------------------------------------------------

        return CreateDonationCheckoutResponse(
            checkout_url=checkout.checkout_url,
            session_id=checkout.token,
            donation_id=donation.id,
            payment_method=data.payment_method,
            instructions=(
                f"Vous allez être redirigé vers PayDunya "
                f"pour effectuer votre paiement via {method_name}."
            ),
        )


# =============================================================
# STRIPE VERIFICATION
# =============================================================

@router.post(
    "/verify",
    response_model=VerifyPaymentResponse,
)
async def verify_payment(
    data: VerifyPaymentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Verify a Stripe payment and update donation status (account optional)."""

    logger.info(
        "Verifying Stripe payment for session: %s",
        data.session_id,
    )

    payment_service = PaymentService()
    donations_service = DonationsService(db)

    try:
        status = await payment_service.get_checkout_status(
            data.session_id
        )

        donation = await donations_service.get_by_field(
            "stripe_session_id",
            data.session_id,
        )

        if donation:
            new_status = (
                "paid"
                if status.payment_status == "paid"
                else "failed"
            )

            # Éviter de retraiter un paiement déjà payé.
            was_already_paid = donation.payment_status == "paid"

            await donations_service.update(
                donation.id,
                {
                    "payment_status": new_status,
                },
            )

            # Email de confirmation uniquement lors du premier
            # passage à paid, envoyé après la réponse.
            if new_status == "paid" and not was_already_paid:
                confirmation = await prepare_donation_confirmation(db, donation)
                if confirmation:
                    background_tasks.add_task(send_email, confirmation, f"donation {donation.id} confirmation")

            # Mise à jour du projet uniquement lors du premier
            # passage à paid.
            if new_status == "paid" and not was_already_paid:
                await credit_project(db, donation)

            return VerifyPaymentResponse(
                status=status.status,
                payment_status=status.payment_status,
                donation_id=donation.id,
                amount=donation.amount,
            )

        return VerifyPaymentResponse(
            status=status.status,
            payment_status=status.payment_status,
        )

    except CheckoutError as exc:
        logger.error(
            "Stripe payment verification error: %s",
            str(exc),
        )

        raise HTTPException(
            status_code=500,
            detail=f"Erreur de vérification Stripe: {str(exc)}",
        ) from exc


# =============================================================
# PAYDUNYA IPN
# =============================================================

@router.post("/paydunya/ipn")
async def paydunya_ipn(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive PayDunya IPN notifications.

    PayDunya sends the notification as
    application/x-www-form-urlencoded with the payment
    information contained in the "data" field.
    """

    logger.info("PayDunya IPN received")

    try:
        # -----------------------------------------------------
        # 1. Lire le formulaire
        # -----------------------------------------------------

        form = await request.form()
        raw_data = form.get("data")

        if raw_data is None:
            logger.warning(
                "PayDunya IPN missing 'data' field"
            )

            raise HTTPException(
                status_code=400,
                detail="Missing PayDunya data",
            )

        # -----------------------------------------------------
        # 2. Décoder les données
        # -----------------------------------------------------

        if isinstance(raw_data, str):

            try:
                payload = json.loads(raw_data)

            except json.JSONDecodeError as exc:
                logger.warning(
                    "PayDunya IPN data is not valid JSON"
                )

                raise HTTPException(
                    status_code=400,
                    detail="Invalid PayDunya data format",
                ) from exc

        elif isinstance(raw_data, dict):

            payload = raw_data

        else:

            logger.warning(
                "Unsupported PayDunya IPN data type: %s",
                type(raw_data).__name__,
            )

            raise HTTPException(
                status_code=400,
                detail="Unsupported PayDunya data format",
            )

        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid PayDunya payload",
            )

        # -----------------------------------------------------
        # 3. Vérification du hash
        # -----------------------------------------------------

        received_hash = str(
            payload.get("hash", "")
        ).strip()

        if not received_hash:
            logger.warning(
                "PayDunya IPN missing hash"
            )

            raise HTTPException(
                status_code=401,
                detail="Missing PayDunya hash",
            )

        if not settings.paydunya_master_key:
            logger.error(
                "PAYDUNYA_MASTER_KEY is not configured"
            )

            raise HTTPException(
                status_code=500,
                detail="PayDunya configuration error",
            )

        expected_hash = hashlib.sha512(
            settings.paydunya_master_key.encode("utf-8")
        ).hexdigest()

        if not hmac.compare_digest(
            received_hash,
            expected_hash,
        ):
            logger.warning(
                "Invalid PayDunya IPN hash"
            )

            raise HTTPException(
                status_code=401,
                detail="Invalid PayDunya hash",
            )

        # -----------------------------------------------------
        # 4. Statut PayDunya
        # -----------------------------------------------------

        status = str(
            payload.get("status", "")
        ).strip().lower()

        invoice = payload.get("invoice") or {}

        if not isinstance(invoice, dict):
            logger.warning(
                "PayDunya IPN invoice section is invalid"
            )

            raise HTTPException(
                status_code=400,
                detail="Invalid invoice data",
            )

        # -----------------------------------------------------
        # 5. Token de facture
        # -----------------------------------------------------

        token = (
            invoice.get("token")
            or payload.get("token")
            or ""
        )

        token = str(token).strip()

        if not token:
            logger.warning(
                "PayDunya IPN missing invoice token"
            )

            raise HTTPException(
                status_code=400,
                detail="Missing PayDunya invoice token",
            )

        logger.info(
            "PayDunya IPN: token=%s status=%s",
            token,
            status,
        )

        # -----------------------------------------------------
        # 6. Recherche du don
        # -----------------------------------------------------

        donations_service = DonationsService(db)

        donation = await donations_service.get_by_field(
            "paydunya_token",
            token,
        )

        if not donation:
            donation = await donations_service.get_by_field(
                "payment_reference",
                token,
            )

        if not donation:
            logger.warning(
                "PayDunya IPN: donation not found for token=%s",
                token,
            )

            # On répond 200 pour éviter des retransmissions
            # inutiles si le don n'existe plus.
            return {
                "success": False,
                "message": "Donation not found",
            }

        # -----------------------------------------------------
        # 7. Vérification du montant
        # -----------------------------------------------------

        invoice_amount = invoice.get("total_amount")

        if invoice_amount is not None:

            try:
                received_amount = int(
                    float(invoice_amount)
                )

            except (TypeError, ValueError) as exc:
                logger.warning(
                    "Invalid PayDunya amount for token=%s",
                    token,
                )

                raise HTTPException(
                    status_code=400,
                    detail="Invalid PayDunya amount",
                ) from exc

            if received_amount != donation.amount:

                logger.error(
                    "PayDunya amount mismatch: "
                    "donation=%s expected=%s received=%s",
                    donation.id,
                    donation.amount,
                    received_amount,
                )

                raise HTTPException(
                    status_code=400,
                    detail="Payment amount mismatch",
                )

        # -----------------------------------------------------
        # 8. Conversion du statut
        # -----------------------------------------------------

        if status == "completed":

            new_payment_status = "paid"

        elif status == "cancelled":

            new_payment_status = "cancelled"

        elif status == "failed":

            new_payment_status = "failed"

        elif status == "pending":

            new_payment_status = "pending"

        else:

            logger.warning(
                "Unknown PayDunya status=%s token=%s",
                status,
                token,
            )

            return {
                "success": False,
                "message": "Unknown payment status",
            }

        # -----------------------------------------------------
        # 9. Idempotence
        # -----------------------------------------------------

        if (
            donation.payment_status == "paid"
            and new_payment_status == "paid"
        ):
            logger.info(
                "PayDunya IPN already processed: "
                "donation_id=%s",
                donation.id,
            )

            return {
                "success": True,
                "message": "Payment already processed",
                "donation_id": donation.id,
                "payment_status": "paid",
            }

        # -----------------------------------------------------
        # 10. Mise à jour du don
        # -----------------------------------------------------

        updated_donation = await donations_service.update(
            donation.id,
            {
                "payment_status": new_payment_status,
                "payment_provider": "paydunya",
                "payment_reference": token,
                "paydunya_token": token,
            },
        )

        if not updated_donation:

            logger.error(
                "Failed to update donation %s "
                "from PayDunya IPN",
                donation.id,
            )

            raise HTTPException(
                status_code=500,
                detail="Failed to update donation",
            )

        # Premier passage à paid (l'idempotence ci-dessus écarte
        # les notifications répétées) : crédit du projet, puis
        # email envoyé après la réponse.
        if new_payment_status == "paid":
            await credit_project(db, updated_donation)
            confirmation = await prepare_donation_confirmation(db, updated_donation)
            if confirmation:
                background_tasks.add_task(send_email, confirmation, f"donation {donation.id} confirmation")

        logger.info(
            "PayDunya IPN processed successfully: "
            "donation_id=%s status=%s",
            donation.id,
            new_payment_status,
        )

        return {
            "success": True,
            "message": "PayDunya IPN processed",
            "donation_id": donation.id,
            "payment_status": new_payment_status,
        }

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "Unexpected PayDunya IPN error: %s",
            str(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Internal IPN processing error",
        ) from exc
