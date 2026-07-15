"""SEP login PKCE: store the code_challenge on one-time exchange codes.

Revision ID: 014_sep_code_challenge
Revises: 013_incubator
Create Date: 2026-07-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015_sep_code_challenge"
down_revision: Union[str, None] = "014_add_internal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "oauth_exchange_codes",
        sa.Column("code_challenge", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("oauth_exchange_codes", "code_challenge")
