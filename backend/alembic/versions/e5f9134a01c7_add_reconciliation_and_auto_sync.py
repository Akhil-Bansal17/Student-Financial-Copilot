"""add_reconciliation_and_auto_sync

Revision ID: e5f9134a01c7
Revises: d4a8e21f9c3b
Create Date: 2026-09-29 20:55:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f9134a01c7'
down_revision: Union[str, None] = 'd4a8e21f9c3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add reconciliation columns to transactions
    op.add_column('transactions', sa.Column('reconciled_with_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('reconciliation_status', sa.String(length=30), server_default='UNRECONCILED', nullable=False))
    op.create_foreign_key(
        'fk_transactions_reconciled_with_id',
        'transactions',
        'transactions',
        ['reconciled_with_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_transactions_reconciled_with_id', 'transactions', ['reconciled_with_id'], unique=False)

    # 2. Add auto-sync, locking, and retry columns to connected_accounts
    op.add_column('connected_accounts', sa.Column('sync_cursor', sa.String(length=255), nullable=True))
    op.add_column('connected_accounts', sa.Column('sync_lock_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('connected_accounts', sa.Column('sync_lock_token', sa.String(length=100), nullable=True))
    op.add_column('connected_accounts', sa.Column('sync_retry_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('connected_accounts', sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('connected_accounts', sa.Column('last_sync_status', sa.String(length=20), nullable=True))
    op.add_column('connected_accounts', sa.Column('last_sync_error', sa.String(length=500), nullable=True))

    # 3. Add trigger and reconciliation audit columns to sync_runs
    op.add_column('sync_runs', sa.Column('trigger_type', sa.String(length=20), server_default='MANUAL', nullable=False))
    op.add_column('sync_runs', sa.Column('transactions_reconciled', sa.Integer(), server_default='0', nullable=False))
    op.add_column('sync_runs', sa.Column('transactions_pending_review', sa.Integer(), server_default='0', nullable=False))
    op.add_column('sync_runs', sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('sync_runs', sa.Column('error_code', sa.String(length=50), nullable=True))

    # 4. Create transaction_reconciliations table
    op.create_table(
        'transaction_reconciliations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('manual_transaction_id', sa.Integer(), nullable=True),
        sa.Column('bank_transaction_id', sa.Integer(), nullable=True),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('external_transaction_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='PENDING_REVIEW', nullable=False),
        sa.Column('match_type', sa.String(length=30), server_default='POSSIBLE_MATCH', nullable=False),
        sa.Column('confidence_score', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('match_reasons', sa.String(length=1000), nullable=True),
        sa.Column('manual_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('manual_description', sa.String(length=255), nullable=True),
        sa.Column('manual_category', sa.String(length=50), nullable=False),
        sa.Column('manual_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('bank_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('bank_description', sa.String(length=255), nullable=True),
        sa.Column('bank_category', sa.String(length=50), nullable=True),
        sa.Column('bank_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_bank_description', sa.String(length=500), nullable=True),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['connected_accounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['bank_transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['manual_transaction_id'], ['transactions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transaction_reconciliations_id', 'transaction_reconciliations', ['id'], unique=False)
    op.create_index('ix_reconciliations_user_status', 'transaction_reconciliations', ['user_id', 'status'], unique=False)
    op.create_index('ix_reconciliations_manual_tx', 'transaction_reconciliations', ['manual_transaction_id'], unique=False)
    op.create_index('ix_reconciliations_bank_tx', 'transaction_reconciliations', ['bank_transaction_id'], unique=False)
    op.create_index('ix_reconciliations_external_tx', 'transaction_reconciliations', ['external_transaction_id'], unique=False)


def downgrade() -> None:
    op.drop_table('transaction_reconciliations')
    op.drop_column('sync_runs', 'error_code')
    op.drop_column('sync_runs', 'retry_count')
    op.drop_column('sync_runs', 'transactions_pending_review')
    op.drop_column('sync_runs', 'transactions_reconciled')
    op.drop_column('sync_runs', 'trigger_type')
    op.drop_column('connected_accounts', 'last_sync_error')
    op.drop_column('connected_accounts', 'last_sync_status')
    op.drop_column('connected_accounts', 'next_retry_at')
    op.drop_column('connected_accounts', 'sync_retry_count')
    op.drop_column('connected_accounts', 'sync_lock_token')
    op.drop_column('connected_accounts', 'sync_lock_at')
    op.drop_column('connected_accounts', 'sync_cursor')
    op.drop_constraint('fk_transactions_reconciled_with_id', 'transactions', type_='foreignkey')
    op.drop_index('ix_transactions_reconciled_with_id', table_name='transactions')
    op.drop_column('transactions', 'reconciliation_status')
    op.drop_column('transactions', 'reconciled_with_id')
