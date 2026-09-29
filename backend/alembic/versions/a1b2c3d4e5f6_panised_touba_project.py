"""add the PANISED Touba vocational school fundraiser, drop the example projects

Revision ID: a1b2c3d4e5f6
Revises: c5d6e7f8a9b0
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TITLE = "École professionnelle PANISED de Touba"

DESCRIPTION = (
    "Le Programme National d'Insertion Socio-Économique des Daaras et des Jeunes Apprenants (PANISED) "
    "construit sa première école de formation professionnelle à Touba. Le site est déjà disponible : "
    "il faut maintenant construire et équiper l'école.\n\n"
    "Les fonds serviront à la construction des salles de formation, à l'aménagement du site, "
    "à l'achat de tables, bancs, tableaux et matériels pédagogiques, à l'équipement des ateliers "
    "et aux installations nécessaires au fonctionnement de l'école.\n\n"
    "Objectif : offrir aux jeunes, aux apprenants des daaras et aux personnes en recherche de "
    "qualification des formations adaptées au marché du travail. "
    "Former, qualifier, accompagner, insérer.\n\n"
    "Il n'y a pas de petite contribution : 1 000, 5 000, 10 000 FCFA ou plus, chacun selon ses moyens."
)

EXAMPLE_TITLES = (
    "École Primaire de Thiès",
    "Clinique Mobile Rurale",
    "Puits d'Eau à Matam",
    "Cantine Scolaire Ziguinchor",
    "Rénovation Centre de Santé",
    "Logements Sociaux Pikine",
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
    # The template's example projects never existed: remove them from the live site
    op.execute(projects.delete().where(projects.c.title.in_(EXAMPLE_TITLES)))

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
                "image": "/collectes/panised-touba.jpg",
                "category": "youth",
                "icon": "GraduationCap",
                "raised": 0,
                "goal": 120_000_000,
                "donors": 0,
                "location": "Touba, Sénégal",
                "urgent": False,
                "is_featured": True,
                "status": "active",
            }
        ],
    )


def downgrade() -> None:
    # Only remove the row while nobody has given to it yet
    op.execute(projects.delete().where(projects.c.title == TITLE).where(projects.c.raised == 0))
