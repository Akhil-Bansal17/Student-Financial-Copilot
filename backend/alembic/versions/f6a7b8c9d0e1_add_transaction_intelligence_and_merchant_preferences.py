"""add_transaction_intelligence_and_merchant_preferences

Revision ID: f6a7b8c9d0e1
Revises: e5f9134a01c7
Create Date: 2026-09-30 08:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f9134a01c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add transaction intelligence and normalization columns to transactions
    op.add_column('transactions', sa.Column('merchant', sa.String(length=100), nullable=True))
    op.add_column('transactions', sa.Column('normalized_merchant', sa.String(length=100), nullable=True))
    op.add_column('transactions', sa.Column('category_confidence', sa.String(length=20), nullable=True))
    op.add_column('transactions', sa.Column('categorization_source', sa.String(length=30), nullable=True))
    op.add_column('transactions', sa.Column('status', sa.String(length=20), server_default='POSTED', nullable=False))

    # 2. Add indexes for fast merchant search, filtering, and aggregation
    op.create_index('ix_transactions_normalized_merchant', 'transactions', ['normalized_merchant'], unique=False)
    op.create_index('ix_transactions_user_id_merchant', 'transactions', ['user_id', 'normalized_merchant'], unique=False)

    # 3. Create merchant_category_preferences table
    op.create_table(
        'merchant_category_preferences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('normalized_merchant', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'normalized_merchant', name='uq_user_merchant_preference'),
    )
    op.create_index('ix_merchant_category_preferences_id', 'merchant_category_preferences', ['id'], unique=False)
    op.create_index('ix_merchant_category_preferences_user_id', 'merchant_category_preferences', ['user_id'], unique=False)
    op.create_index('ix_user_merchant_pref', 'merchant_category_preferences', ['user_id', 'normalized_merchant'], unique=False)

    # 4. Safe backfill for existing transactions
    op.execute(
        sa.text(
            "UPDATE transactions SET "
            "status = 'POSTED', "
            "categorization_source = CASE WHEN source = 'MANUAL' THEN 'USER_MANUAL' ELSE 'PROVIDER' END, "
            "category_confidence = CASE WHEN source = 'MANUAL' THEN 'HIGH' ELSE 'HIGH' END "
            "WHERE status IS NULL OR categorization_source IS NULL"
        )
    )


def downgrade() -> None:
    # 1. Drop merchant_category_preferences table and indexes
    op.drop_index('ix_user_merchant_pref', table_name='merchant_category_preferences')
    op.drop_index('ix_merchant_category_preferences_user_id', table_name='merchant_category_preferences')
    op.drop_index('ix_merchant_category_preferences_id', table_name='merchant_category_preferences')
    op.drop_table('merchant_category_preferences')

    # 2. Drop indexes on transactions
    op.drop_index('ix_transactions_user_id_merchant', table_name='transactions')
    op.drop_index('ix_transactions_normalized_merchant', table_name='transactions')

    # 3. Drop added columns on transactions
    op.drop_column('transactions', 'status')
    op.drop_column('transactions', 'categorization_source')
    op.drop_column('transactions', 'category_confidence')
    op.drop_column('transactions', 'normalized_merchant')
    op.drop_column('transactions', 'merchant')
