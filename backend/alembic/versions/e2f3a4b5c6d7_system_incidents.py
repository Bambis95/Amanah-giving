"""System incidents: crashes, outages and overloads shown to the admins

Revision ID: e2f3a4b5c6d7
Revises: a1c2e3f4b5d6
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "a1c2e3f4b5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("system_incidents"):
        return
    op.create_table(
        "system_incidents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("path", sa.String(length=200), nullable=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("emailed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolution_note", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_system_incidents_id", "system_incidents", ["id"])
    op.create_index("ix_system_incidents_fingerprint", "system_incidents", ["fingerprint"])
    op.create_index("ix_system_incidents_last_seen", "system_incidents", ["last_seen"])
    op.create_index("ix_system_incidents_resolved_at", "system_incidents", ["resolved_at"])


def downgrade() -> None:
    op.drop_table("system_incidents")
