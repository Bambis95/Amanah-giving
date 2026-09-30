"""newsletter: subscribers (explicit consent) and sent issues

Revision ID: a3b4c5d6e7f9
Revises: f2a3b4c5d6e8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f9"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    # The app creates missing tables at startup, so they may already exist
    if not inspector.has_table("newsletter_subscribers"):
        op.create_table(
            "newsletter_subscribers",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("source", sa.String(length=30), nullable=False),
            sa.Column("token", sa.String(length=64), nullable=False),
            sa.Column("consent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_newsletter_subscribers_id"), "newsletter_subscribers", ["id"], unique=False)
        op.create_index(op.f("ix_newsletter_subscribers_email"), "newsletter_subscribers", ["email"], unique=True)
        op.create_index(op.f("ix_newsletter_subscribers_token"), "newsletter_subscribers", ["token"], unique=True)
    if not inspector.has_table("newsletter_issues"):
        op.create_table(
            "newsletter_issues",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("subject", sa.String(length=150), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=True),
            sa.Column("recipients", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sent_by", sa.String(length=255), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["sent_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_newsletter_issues_id"), "newsletter_issues", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("newsletter_issues")
    op.drop_table("newsletter_subscribers")
