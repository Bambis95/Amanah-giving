"""align users table with model

Revision ID: b7c1d2e3f4a5
Revises: 6a6e060410b5
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "6a6e060410b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    password_hash = next(
        column for column in inspector.get_columns("users")
        if column["name"] == "password_hash"
    )
    if password_hash["nullable"]:
        op.alter_column(
            "users",
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=False,
        )

    existing_indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_email" not in existing_indexes:
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )
