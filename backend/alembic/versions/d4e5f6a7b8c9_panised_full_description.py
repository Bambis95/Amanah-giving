"""use the full PANISED Touba campaign text as its description

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TITLE = "École professionnelle PANISED de Touba"

# The campaign text as written by PANISED (the card shows its first lines, "Lire la suite" all of it)
DESCRIPTION = """Le Programme National d'Insertion Socio-Économique des Daaras et des Jeunes Apprenants (PANISED) lance une collecte pour la construction de sa première école de formation professionnelle à Touba.

LE SITE EST DÉJÀ DISPONIBLE
Nous voulons maintenant mobiliser les moyens nécessaires pour construire et équiper l'école.

À QUOI SERVIRONT LES CONTRIBUTIONS ?
Les fonds collectés permettront de financer :
• la construction des salles de formation ;
• l'aménagement du site ;
• l'achat de tables, bancs et tableaux ;
• l'achat de matériels pédagogiques ;
• l'équipement des ateliers de formation ;
• les installations nécessaires au fonctionnement de l'école.

NOTRE OBJECTIF
Offrir aux jeunes, aux apprenants des daaras et aux personnes en recherche de qualification un accès à des formations professionnelles adaptées aux besoins du marché.
L'objectif est simple : FORMER • QUALIFIER • ACCOMPAGNER • INSÉRER

CHAQUE CONTRIBUTION COMPTE
Il n'y a pas de petite contribution. 1 000 FCFA, 5 000 FCFA, 10 000 FCFA, 25 000 FCFA, 50 000 FCFA ou plus : chacun contribue selon ses moyens.
Votre participation contribuera directement à la réalisation de cette école et à la formation professionnelle des jeunes.

OBJECTIF À ATTEINDRE : 120 000 000 FCFA

Un site existe.
Un projet est prêt.
Ensemble, construisons l'école.

Je contribue • Je partage • Je soutiens la formation et l'insertion des jeunes"""

projects = sa.table(
    "projects",
    sa.column("title", sa.String),
    sa.column("description", sa.String),
)


def upgrade() -> None:
    op.execute(projects.update().where(projects.c.title == TITLE).values(description=DESCRIPTION))


def downgrade() -> None:
    # The short text is kept in revision a1b2c3d4e5f6
    pass
