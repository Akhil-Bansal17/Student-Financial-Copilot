"""add_personalization_profiles

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-10-05 14:40:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personalization_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_personalization_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("alert_sensitivity", sa.String(length=32), nullable=False, server_default="BALANCED"),
        sa.Column("financial_priority", sa.String(length=64), nullable=False, server_default="BALANCED"),
        sa.Column("large_transaction_threshold", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("recurring_alert_days_before", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_personalization_profile"),
    )
    op.create_index(
        "ix_personalization_profiles_id",
        "personalization_profiles",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_personalization_profiles_user_id",
        "personalization_profiles",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_personalization_profiles_user_id", table_name="personalization_profiles")
    op.drop_index("ix_personalization_profiles_id", table_name="personalization_profiles")
    op.drop_table("personalization_profiles")
