"""Deposits made by scanning the Wave / Orange Money QR codes.

The money goes straight to the operator account, so the platform only learns about it when the
donor declares the deposit. The declaration is stored as a pending donation; an administrator
checks the transaction in the Wave / Orange Money app and confirms it (the donation then counts
in the statistics and the campaign, and the donor gets the confirmation email) or rejects it.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_actor, get_optional_user
from models.donations import Donations
from models.projects import Projects
from routers.payment_checkout import credit_project
from schemas.auth import UserResponse
from services import audit
from services.audit import Actor
from services.donations import DonationsService
from services.email import prepare_donation_confirmation, send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payment/mobile-deposit", tags=["payment"])

PROVIDER = "mobile_qr"
MIN_AMOUNT = 100
OPERATOR_LABELS = {"wave": "Wave", "orange_money": "Orange Money"}


class DepositDeclaration(BaseModel):
    amount: int
    payment_method: Literal["wave", "orange_money"]
    # Transaction ID shown by the operator app / SMS after the transfer
    transaction_ref: str = Field(min_length=4, max_length=64)
    donor_phone: str = Field(min_length=6, max_length=30)
    donor_first_name: Optional[str] = Field(default=None, max_length=80)
    donor_last_name: Optional[str] = Field(default=None, max_length=80)
    donor_email: Optional[EmailStr] = None
    project_id: Optional[int] = None
    cause: str = Field(default="general", max_length=40)
    message: Optional[str] = Field(default=None, max_length=1000)


class DepositDeclared(BaseModel):
    donation_id: int
    payment_status: str


@router.post("", response_model=DepositDeclared, status_code=201)
async def declare_deposit(
    data: DepositDeclaration,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """A donor declares a Wave / Orange Money deposit made with the QR code (account optional)."""
    if data.amount < MIN_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Le montant minimum est de {MIN_AMOUNT} FCFA.")

    reference = data.transaction_ref.strip().upper()
    # The same transaction cannot be declared twice (it would be counted twice once confirmed)
    duplicate = (
        await db.execute(
            select(func.count(Donations.id)).where(
                Donations.payment_provider == PROVIDER,
                Donations.payment_method == data.payment_method,
                func.upper(Donations.payment_reference) == reference,
                Donations.payment_status.in_(("pending", "paid")),
            )
        )
    ).scalar_one()
    if duplicate:
        raise HTTPException(status_code=409, detail="Cette transaction a déjà été déclarée.")

    cause = data.cause
    if data.project_id is not None:
        project = await db.get(Projects, data.project_id)
        if not project:
            raise HTTPException(status_code=400, detail="Cette campagne n'existe pas.")
        cause = project.category

    donation = await DonationsService(db).create(
        {
            "amount": data.amount,
            "cause": cause,
            "project_id": data.project_id,
            "payment_method": data.payment_method,
            "payment_status": "pending",
            "payment_provider": PROVIDER,
            "payment_reference": reference,
            "donor_first_name": data.donor_first_name,
            "donor_last_name": data.donor_last_name,
            "donor_email": data.donor_email,
            "donor_phone": data.donor_phone.strip(),
            "message": data.message,
        },
        user_id=str(current_user.id) if current_user else None,
    )
    if not donation:
        raise HTTPException(status_code=500, detail="La déclaration n'a pas pu être enregistrée.")
    logger.info("Mobile deposit declared: donation=%s method=%s", donation.id, data.payment_method)
    return DepositDeclared(donation_id=donation.id, payment_status=donation.payment_status)


async def _pending_deposit(db: AsyncSession, donation_id: int) -> Donations:
    donation = await db.get(Donations, donation_id)
    if not donation or donation.payment_provider != PROVIDER:
        raise HTTPException(status_code=404, detail="Dépôt introuvable.")
    if donation.payment_status != "pending":
        raise HTTPException(status_code=409, detail="Ce dépôt a déjà été traité.")
    return donation


def _describe(donation: Donations) -> str:
    who = " ".join(filter(None, [donation.donor_first_name, donation.donor_last_name])) or donation.donor_phone
    operator = OPERATOR_LABELS.get(donation.payment_method, donation.payment_method)
    return f"{donation.amount} FCFA par {operator} ({donation.payment_reference}) de {who}"


@router.post("/{donation_id}/confirm", response_model=DepositDeclared)
async def confirm_deposit(
    donation_id: int,
    background_tasks: BackgroundTasks,
    actor: Actor = Depends(get_admin_actor),
    db: AsyncSession = Depends(get_db),
):
    """Admin: the deposit was found in the operator account; count it and thank the donor."""
    donation = await _pending_deposit(db, donation_id)
    donation.payment_status = "paid"
    await db.commit()
    await db.refresh(donation)
    await credit_project(db, donation)
    confirmation = await prepare_donation_confirmation(db, donation)
    if confirmation:
        background_tasks.add_task(send_email, confirmation, f"donation {donation.id} confirmation")
    await audit.record(
        db, actor, "donation.confirm", f"Dépôt confirmé : {_describe(donation)}",
        target_type="donation", target_id=donation.id,
    )
    return DepositDeclared(donation_id=donation.id, payment_status=donation.payment_status)


@router.post("/{donation_id}/reject", response_model=DepositDeclared)
async def reject_deposit(
    donation_id: int,
    actor: Actor = Depends(get_admin_actor),
    db: AsyncSession = Depends(get_db),
):
    """Admin: no matching transaction in the operator account."""
    donation = await _pending_deposit(db, donation_id)
    donation.payment_status = "cancelled"
    await db.commit()
    await audit.record(
        db, actor, "donation.reject", f"Dépôt rejeté : {_describe(donation)}",
        target_type="donation", target_id=donation.id,
    )
    return DepositDeclared(donation_id=donation.id, payment_status=donation.payment_status)
