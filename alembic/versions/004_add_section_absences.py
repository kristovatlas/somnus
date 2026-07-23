"""Add section_absences table — explicit "did not do X" data state (#159).

The third data state alongside a recorded value ("did it") and a blank/NULL
("not recorded"): a row here means the user explicitly marked a log section as
not done for the date, giving the 8 binary habits (alcohol, NSDR, sauna, ...)
the variance they need to become correlatable. Purely additive — existing
daily logs are untouched and a blank day keeps its "not recorded" meaning.

Revision ID: 004
Revises: 003
Create Date: 2026-07-23
"""

import sqlalchemy as sa

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "section_absences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("section_key", sa.String(length=150), nullable=False),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date", "section_key", name="uq_section_absence"),
    )


def downgrade() -> None:
    op.drop_table("section_absences")
