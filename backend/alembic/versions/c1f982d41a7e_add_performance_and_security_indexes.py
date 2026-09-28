"""add_performance_and_security_indexes

Revision ID: c1f982d41a7e
Revises: bde0a4bb094f
Create Date: 2026-09-28 16:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1f982d41a7e'
down_revision: Union[str, None] = 'bde0a4bb094f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite indexes for high-frequency time-series queries and user-isolated aggregates
    op.create_index(
        'ix_transactions_user_id_date',
        'transactions',
        ['user_id', 'transaction_date'],
        unique=False,
    )
    op.create_index(
        'ix_transactions_user_id_type_date',
        'transactions',
        ['user_id', 'transaction_type', 'transaction_date'],
        unique=False,
    )
    op.create_index(
        'ix_goal_contributions_goal_id_created_at',
        'goal_contributions',
        ['goal_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_goal_contributions_goal_id_created_at', table_name='goal_contributions')
    op.drop_index('ix_transactions_user_id_type_date', table_name='transactions')
    op.drop_index('ix_transactions_user_id_date', table_name='transactions')
