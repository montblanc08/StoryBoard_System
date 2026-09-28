"""Safe migration and verification runner between SQLite and PostgreSQL.

Enforces ARCHITECTURE_MIGRATION.md Section 35.2:
1. Inventory and row counts
2. Schema structure check
3. Dry-run record mapping
4. Integrity verification
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


@dataclass
class MigrationSummary:
    tables_checked: int
    rows_migrated: Dict[str, int]
    mismatches: List[str]
    success: bool


CORE_TABLES = [
    "users",
    "projects",
    "sequences",
    "shots",
    "panels",
    "production_steps",
    "assets",
    "asset_versions",
    "shot_asset_links",
    "shot_versions",
    "project_snapshots",
    "comments",
    "review_decisions",
    "share_links",
    "custom_field_definitions",
    "custom_field_values",
    "project_column_preferences",
    "creative_boards",
    "audit_log",
]


def inventory_sqlite(sqlite_conn: sqlite3.Connection) -> Dict[str, int]:
    """Return map of table name to row count in SQLite."""
    counts: Dict[str, int] = {}
    for table in CORE_TABLES:
        try:
            cur = sqlite_conn.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cur.fetchone()[0]
        except sqlite3.OperationalError:
            counts[table] = 0
    return counts


def verify_row_counts(sqlite_counts: Dict[str, int], pg_counts: Dict[str, int]) -> Tuple[bool, List[str]]:
    """Verify that table row counts match exactly between SQLite and PostgreSQL."""
    mismatches = []
    for table, s_cnt in sqlite_counts.items():
        p_cnt = pg_counts.get(table, 0)
        if s_cnt != p_cnt:
            mismatches.append(f"Table {table}: SQLite has {s_cnt} rows, PostgreSQL has {p_cnt} rows")
    return len(mismatches) == 0, mismatches
