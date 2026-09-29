"""add_bank_sync_and_connected_accounts

Revision ID: d4a8e21f9c3b
Revises: c1f982d41a7e
Create Date: 2026-09-29 18:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a8e21f9c3b'
down_revision: Union[str, None] = 'c1f982d41a7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create connected_accounts table
    op.create_table(
        'connected_accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_account_id', sa.String(length=100), nullable=False),
        sa.Column('institution_name', sa.String(length=100), nullable=False),
        sa.Column('account_type', sa.String(length=50), server_default='savings', nullable=False),
        sa.Column('masked_account_number', sa.String(length=50), nullable=False),
        sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('current_balance', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('balance_as_of', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'provider', 'provider_account_id', name='uq_user_provider_account')
    )
    op.create_index('ix_connected_accounts_id', 'connected_accounts', ['id'], unique=False)
    op.create_index('ix_connected_accounts_user_id', 'connected_accounts', ['user_id'], unique=False)

    # 2. Create account_consents table
    op.create_table(
        'account_consents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('consent_id', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('purpose', sa.String(length=255), server_default='Personal Finance Management', nullable=False),
        sa.Column('data_range_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('data_range_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['connected_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_account_consents_account_id', 'account_consents', ['account_id'], unique=False)
    op.create_index('ix_account_consents_consent_id', 'account_consents', ['consent_id'], unique=False)
    op.create_index('ix_account_consents_id', 'account_consents', ['id'], unique=False)
    op.create_index('ix_account_consents_user_id', 'account_consents', ['user_id'], unique=False)

    # 3. Create sync_runs table
    op.create_table(
        'sync_runs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='RUNNING', nullable=False),
        sa.Column('transactions_fetched', sa.Integer(), server_default='0', nullable=False),
        sa.Column('transactions_imported', sa.Integer(), server_default='0', nullable=False),
        sa.Column('transactions_skipped', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_message', sa.String(length=500), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['connected_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sync_runs_account_id', 'sync_runs', ['account_id'], unique=False)
    op.create_index('ix_sync_runs_id', 'sync_runs', ['id'], unique=False)
    op.create_index('ix_sync_runs_user_id', 'sync_runs', ['user_id'], unique=False)

    # 4. Add provenance columns to transactions table
    op.add_column('transactions', sa.Column('source', sa.String(length=20), server_default='MANUAL', nullable=False))
    op.add_column('transactions', sa.Column('provider', sa.String(length=50), nullable=True))
    op.add_column('transactions', sa.Column('account_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('external_transaction_id', sa.String(length=255), nullable=True))
    op.add_column('transactions', sa.Column('external_account_id', sa.String(length=100), nullable=True))
    op.add_column('transactions', sa.Column('raw_bank_description', sa.String(length=500), nullable=True))
    op.add_column('transactions', sa.Column('sync_run_id', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('imported_at', sa.DateTime(timezone=True), nullable=True))

    # 5. Foreign keys and indexes for transactions
    op.create_foreign_key('fk_transactions_account_id', 'transactions', 'connected_accounts', ['account_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_transactions_sync_run_id', 'transactions', 'sync_runs', ['sync_run_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_transactions_account_id', 'transactions', ['account_id'], unique=False)
    op.create_index('ix_transactions_sync_run_id', 'transactions', ['sync_run_id'], unique=False)
    op.create_index('ix_transactions_external_transaction_id', 'transactions', ['external_transaction_id'], unique=False)
    op.create_index(
        'uq_transactions_provider_account_external_id',
        'transactions',
        ['provider', 'external_account_id', 'external_transaction_id'],
        unique=True,
        postgresql_where=sa.text('external_transaction_id IS NOT NULL'),
    )


def downgrade() -> None:
    # 1. Drop transactions indexes, foreign keys, and columns
    op.drop_index('uq_transactions_provider_account_external_id', table_name='transactions')
    op.drop_index('ix_transactions_external_transaction_id', table_name='transactions')
    op.drop_index('ix_transactions_sync_run_id', table_name='transactions')
    op.drop_index('ix_transactions_account_id', table_name='transactions')
    op.drop_constraint('fk_transactions_sync_run_id', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transactions_account_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'imported_at')
    op.drop_column('transactions', 'sync_run_id')
    op.drop_column('transactions', 'raw_bank_description')
    op.drop_column('transactions', 'external_account_id')
    op.drop_column('transactions', 'external_transaction_id')
    op.drop_column('transactions', 'account_id')
    op.drop_column('transactions', 'provider')
    op.drop_column('transactions', 'source')

    # 2. Drop sync_runs table
    op.drop_index('ix_sync_runs_user_id', table_name='sync_runs')
    op.drop_index('ix_sync_runs_id', table_name='sync_runs')
    op.drop_index('ix_sync_runs_account_id', table_name='sync_runs')
    op.drop_table('sync_runs')

    # 3. Drop account_consents table
    op.drop_index('ix_account_consents_user_id', table_name='account_consents')
    op.drop_index('ix_account_consents_id', table_name='account_consents')
    op.drop_index('ix_account_consents_consent_id', table_name='account_consents')
    op.drop_index('ix_account_consents_account_id', table_name='account_consents')
    op.drop_table('account_consents')

    # 4. Drop connected_accounts table
    op.drop_index('ix_connected_accounts_user_id', table_name='connected_accounts')
    op.drop_index('ix_connected_accounts_id', table_name='connected_accounts')
    op.drop_table('connected_accounts')
