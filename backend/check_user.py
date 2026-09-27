import asyncio
from sqlalchemy import select
from core.database import get_db
from models.auth import User

async def main():
    db_generator = get_db()
    db = await anext(db_generator)

    try:
        result = await db.execute(
            select(User).where(User.email == "khadimbaeft@gmail.com")
        )
        user = result.scalar_one_or_none()

        if user is None:
            print("USER_FOUND: NO")
        else:
            print("USER_FOUND: YES")
            print("USER_ID:", user.id)
            print("EMAIL:", user.email)
            print("NAME:", user.name)
            print("ROLE:", user.role)
            print("PASSWORD_HASH_PRESENT:", bool(user.password_hash))
            print("PASSWORD_HASH_LENGTH:", len(user.password_hash))
    finally:
        await db.close()

asyncio.run(main())
