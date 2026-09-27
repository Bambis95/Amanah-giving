"""Promote an existing account to administrator (first admin of a new deployment).

Create the account on the website first, then, from the backend folder (Render: Shell tab):
    python -m scripts.make_admin votre@email.com
Later promotions are done from the admin dashboard (Utilisateurs tab).
"""

import asyncio
import sys

from sqlalchemy import select


async def main(email: str) -> int:
    from core.database import db_manager
    from models.auth import User
    from services import audit
    from services.audit import Actor

    await db_manager.init_db()
    try:
        async with db_manager.async_session_maker() as db:
            user = (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
            if not user:
                print(f"Aucun compte avec l'email {email} : créez-le d'abord sur le site.")
                return 1
            if user.role == "admin":
                print(f"{user.email} est déjà administrateur.")
                return 0
            user.role = "admin"
            await db.commit()
            await audit.record(
                db, Actor(), "user.role_change", f"{user.email} : promu administrateur (ligne de commande)",
                target_type="user", target_id=user.id, details={"role": {"avant": "user", "apres": "admin"}},
            )
            print(f"{user.email} est maintenant administrateur.")
            return 0
    finally:
        await db_manager.close_db()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage : python -m scripts.make_admin votre@email.com")
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1])))
