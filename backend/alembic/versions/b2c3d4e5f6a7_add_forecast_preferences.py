"""add_forecast_preferences

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-02 07:15:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create forecast_preferences table for user configurable minimum balance safety threshold
    op.create_table(
        "forecast_preferences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("minimum_balance_threshold", sa.Numeric(precision=12, scale=2), nullable=False, server_default="2000.00"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_forecast_preference"),
    )
    op.create_index("ix_forecast_preferences_id", "forecast_preferences", ["id"], unique=False)
    op.create_index("ix_forecast_preferences_user_id", "forecast_preferences", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_forecast_preferences_user_id", table_name="forecast_preferences")
    op.drop_index("ix_forecast_preferences_id", table_name="forecast_preferences")
    op.drop_table("forecast_preferences")
