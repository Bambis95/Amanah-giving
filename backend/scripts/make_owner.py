"""Name the technical owner of the platform (the service provider, as written in the contract).

Only when nobody holds the status yet; afterwards it moves only by a transfer made by the owner
himself (dashboard, Utilisateurs tab). The account must already be an administrator.
From the backend folder (Render: Shell tab):
    python -m scripts.make_owner votre@email.com
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
            current = (await db.execute(select(User).where(User.is_technical_owner.is_(True)))).scalar_one_or_none()
            if current:
                print(f"{current.email} est déjà propriétaire technique : seul ce compte peut transférer le statut.")
                return 1
            user = (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
            if not user or user.role != "admin":
                print(f"{email} doit d'abord être un compte administrateur (python -m scripts.make_admin).")
                return 1
            user.is_technical_owner = True
            await db.commit()
            await audit.record(
                db, Actor(), "security.owner_set", f"{user.email} : désigné propriétaire technique (ligne de commande)",
                target_type="user", target_id=user.id,
            )
            print(f"{user.email} est maintenant propriétaire technique. Ce statut est visible par toute l'équipe.")
            return 0
    finally:
        await db_manager.close_db()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage : python -m scripts.make_owner votre@email.com")
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1])))
