import asyncio
from sqlalchemy import select
from core.database import get_db
from models.donations import Donations

async def main():
    db_generator = get_db()
    db = await anext(db_generator)

    try:
        result = await db.execute(
            select(Donations).where(Donations.id == 2)
        )
        donation = result.scalar_one_or_none()

        if donation is None:
            print("DONATION_FOUND: NO")
            return

        print("DONATION_FOUND: YES")
        print("ID:", donation.id)
        print("AMOUNT:", donation.amount)
        print("PAYMENT_METHOD:", donation.payment_method)
        print("PAYMENT_STATUS:", donation.payment_status)
        print("PAYMENT_PROVIDER:", donation.payment_provider)
        print("PAYMENT_REFERENCE:", donation.payment_reference)
        print("CHECKOUT_URL_PRESENT:", bool(donation.payment_checkout_url))
        print("PAYDUNYA_TOKEN_PRESENT:", bool(donation.paydunya_token))

    finally:
        await db.close()

asyncio.run(main())
