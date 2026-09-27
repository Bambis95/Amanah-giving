import asyncio
import bcrypt
from sqlalchemy import select
from core.database import get_db
from models.auth import User

PASSWORD = "AmanahTest2026!"

async def main():
    async for db in get_db():
        result = await db.execute(
            select(User).where(User.email == "khadimbaeft@gmail.com")
        )
        user = result.scalar_one_or_none()

        if not user:
            print("USER NOT FOUND")
            return

        valid = bcrypt.checkpw(
            PASSWORD.encode(),
            user.password_hash.encode()
        )

        print("PASSWORD VALID:", valid)
        break

asyncio.run(main())