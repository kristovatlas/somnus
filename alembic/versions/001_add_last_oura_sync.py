"""Add last_oura_sync column to user_settings.

Revision ID: 001
Revises:
Create Date: 2026-02-18
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = "000_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("last_oura_sync", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_settings", "last_oura_sync")
