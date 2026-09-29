"""add the completed CCES training of 400 women in Fandène

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TITLE = "400 femmes formées à Fandène"

DESCRIPTION = (
    "Le Club des Créateurs et Entrepreneurs du Sénégal (CCES) a organisé une formation au profit de "
    "400 femmes de la commune de Fandène, dans la région de Thiès.\n\n"
    "Pendant les sessions, les participantes ont appris à fabriquer elles-mêmes des produits "
    "de consommation courante, comme le savon et les produits d'entretien, et à les vendre. "
    "L'objectif : leur donner un savoir-faire qui leur permet de créer une activité génératrice de "
    "revenus, seules ou en groupement.\n\n"
    "Cette action montre ce que le CCES réalise déjà sur le terrain. Avec vos dons, nous pouvons "
    "former plus de femmes dans d'autres communes du Sénégal."
)

projects = sa.table(
    "projects",
    sa.column("title", sa.String),
    sa.column("description", sa.String),
    sa.column("image", sa.String),
    sa.column("category", sa.String),
    sa.column("icon", sa.String),
    sa.column("raised", sa.Integer),
    sa.column("goal", sa.Integer),
    sa.column("donors", sa.Integer),
    sa.column("location", sa.String),
    sa.column("urgent", sa.Boolean),
    sa.column("is_featured", sa.Boolean),
    sa.column("status", sa.String),
)


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(sa.select(sa.func.count()).select_from(projects).where(projects.c.title == TITLE)).scalar()
    if exists:
        return
    op.bulk_insert(
        projects,
        [
            {
                "title": TITLE,
                "description": DESCRIPTION,
                "image": "/collectes/femmes-fandene.jpg",
                "category": "women",
                "icon": "Users",
                # A past action, not a fundraiser: no goal, so the card shows no progress bar
                "raised": 0,
                "goal": 0,
                "donors": 0,
                "location": "Fandène, Thiès",
                "urgent": False,
                "is_featured": False,
                "status": "completed",
            }
        ],
    )


def downgrade() -> None:
    op.execute(projects.delete().where(projects.c.title == TITLE))
