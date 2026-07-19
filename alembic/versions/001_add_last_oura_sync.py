"""Add last_oura_sync column to user_settings.

Revision ID: 001
Revises: 000_baseline
Create Date: 2026-02-18
"""

import sqlalchemy as sa

from alembic import op

revision = "001"
down_revision = "000_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("last_oura_sync", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_settings", "last_oura_sync")
