"""add_recurring_expenses_and_preferences

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-10-02 06:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create recurring_preferences table for user overrides
    op.create_table(
        "recurring_preferences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("normalized_merchant", sa.String(length=100), nullable=False),
        sa.Column("preference_type", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "normalized_merchant", name="uq_user_recurring_preference"),
    )
    op.create_index("ix_recurring_preferences_id", "recurring_preferences", ["id"], unique=False)
    op.create_index("ix_recurring_preferences_user_id", "recurring_preferences", ["user_id"], unique=False)
    op.create_index("ix_user_recurring_pref", "recurring_preferences", ["user_id", "normalized_merchant"], unique=False)

    # 2. Create recurring_expenses table for persistent recurring records
    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("merchant", sa.String(length=100), nullable=False),
        sa.Column("normalized_merchant", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("recurring_type", sa.String(length=30), server_default="RECURRING_EXPENSE", nullable=False),
        sa.Column("frequency", sa.String(length=20), server_default="MONTHLY", nullable=False),
        sa.Column("is_variable_amount", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("confidence", sa.String(length=20), server_default="HIGH", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="ACTIVE", nullable=False),
        sa.Column("average_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("latest_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("previous_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("min_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("max_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("amount_change", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("amount_change_percentage", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("occurrence_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("last_occurrence_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_expected_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "normalized_merchant", name="uq_user_recurring_expense"),
    )
    op.create_index("ix_recurring_expenses_id", "recurring_expenses", ["id"], unique=False)
    op.create_index("ix_recurring_expenses_user_id", "recurring_expenses", ["user_id"], unique=False)
    op.create_index("ix_recurring_expenses_user_merchant", "recurring_expenses", ["user_id", "normalized_merchant"], unique=False)
    op.create_index("ix_recurring_expenses_user_status", "recurring_expenses", ["user_id", "status"], unique=False)
    op.create_index("ix_recurring_expenses_user_next_date", "recurring_expenses", ["user_id", "next_expected_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_recurring_expenses_user_next_date", table_name="recurring_expenses")
    op.drop_index("ix_recurring_expenses_user_status", table_name="recurring_expenses")
    op.drop_index("ix_recurring_expenses_user_merchant", table_name="recurring_expenses")
    op.drop_index("ix_recurring_expenses_user_id", table_name="recurring_expenses")
    op.drop_index("ix_recurring_expenses_id", table_name="recurring_expenses")
    op.drop_table("recurring_expenses")

    op.drop_index("ix_user_recurring_pref", table_name="recurring_preferences")
    op.drop_index("ix_recurring_preferences_user_id", table_name="recurring_preferences")
    op.drop_index("ix_recurring_preferences_id", table_name="recurring_preferences")
    op.drop_table("recurring_preferences")
