"""add native user authentication

Revision ID: e3a251748956
Revises: 903da2d6c43f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3a251748956"
down_revision: Union[str, Sequence[str], None] = "903da2d6c43f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Fresh database: create the users table directly from scratch
    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=50), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
            sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    if "password_hash" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "password_hash",
                sa.String(length=255),
                nullable=True,
            ),
        )

    if "role" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "role",
                sa.String(length=50),
                nullable=False,
                server_default="user",
            ),
        )

    if "created_at" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
        )

    if "last_login" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "last_login",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    if "last_login" in existing_columns:
        op.drop_column("users", "last_login")

    if "created_at" in existing_columns:
        op.drop_column("users", "created_at")

    if "role" in existing_columns:
        op.drop_column("users", "role")

    if "password_hash" in existing_columns:
        op.drop_column("users", "password_hash")