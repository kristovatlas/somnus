"""Add per-session distance to red_light_entries (#60).

Enables inverse-square dose adjustment: the panel's irradiance is specified
at its default_distance_inches (reference); a session logged at a different
distance scales the dose by (reference / actual)^2.

Revision ID: 003
Revises: 002
Create Date: 2026-07-16
"""

import sqlalchemy as sa

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "red_light_entries",
        sa.Column("distance_inches", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("red_light_entries", "distance_inches")
