"""add the national daara and ndayu daara training campaign

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TITLE = "Campagne nationale de formation des daaras et ndayu daara"

DESCRIPTION = (
    "Dans le cadre du PANISED, le Club des Créateurs et Entrepreneurs du Sénégal (CCES), en partenariat "
    "stratégique avec RABITA – Ligue des Écoles Coraniques du Sénégal, forme 2 500 jeunes issus des daaras "
    "et des ndayu daara. Les formations ont déjà démarré.\n\n"
    "Objectif : leur donner des compétences professionnelles et entrepreneuriales pour favoriser leur "
    "autonomie et leur insertion socio-économique.\n\n"
    "Les formations couvrent les métiers professionnels, la transformation, l'entrepreneuriat, le numérique "
    "et les activités génératrices de revenus. Former, qualifier, accompagner, insérer.\n\n"
    "Ensemble, donnons aux jeunes des daaras les compétences pour construire leur avenir."
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
                "image": "/collectes/formation-daaras.jpg",
                "category": "education",
                "icon": "BookOpen",
                "raised": 0,
                "goal": 10_000_000,
                "donors": 0,
                "location": "Tout le Sénégal",
                "urgent": False,
                "is_featured": True,
                "status": "active",
            }
        ],
    )


def downgrade() -> None:
    # Only remove the row while nobody has given to it yet
    op.execute(projects.delete().where(projects.c.title == TITLE).where(projects.c.raised == 0))
