"""project_updates: dated news of each campaign

Revision ID: e1f2a3b4c5d7
Revises: d0e1f2a3b4c5
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d7"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app creates missing tables at startup, so the table may already exist
    if sa.inspect(op.get_bind()).has_table("project_updates"):
        return
    op.create_table(
        "project_updates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("image", sa.String(length=500), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_updates_id"), "project_updates", ["id"], unique=False)
    op.create_index(op.f("ix_project_updates_project_id"), "project_updates", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_updates_published_at"), "project_updates", ["published_at"], unique=False)


def downgrade() -> None:
    op.drop_table("project_updates")
