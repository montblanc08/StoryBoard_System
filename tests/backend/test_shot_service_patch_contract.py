"""Dependency-light runtime contract for ShotService's PATCH command.

The service class is compiled from its actual source so these focused checks
can run without opening a database or importing the API runtime.
"""

import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import unittest


class _Field:
    def __eq__(self, other):
        return True

    def is_(self, other):
        return True


class _Shot:
    id = _Field()
    deleted_at = _Field()

    def __init__(self):
        self.id = "shot-1"
        self.production_id = "production-1"
        self.created_by = "creator-1"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.updated_at = self.created_at
        self.deleted_at = None
        self.sort_index = 1000.0
        self.current_version = 1
        self.revision = 3
        self.name = "Original"
        self.panels = []


class _Select:
    def where(self, *conditions):
        return self


class _Session:
    def __init__(self, shot):
        self.shot = shot
        self.flush_count = 0

    async def execute(self, statement):
        return SimpleNamespace(scalar_one_or_none=lambda: self.shot)

    async def flush(self):
        self.flush_count += 1


class _ConflictError(Exception):
    def __init__(self, message, details):
        self.details = details
        super().__init__(message)


def _service_class():
    source = Path(__file__).resolve().parents[2] / "apps" / "api" / "app" / "services" / "shot_service.py"
    module = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    service_node = next(node for node in module.body if isinstance(node, ast.ClassDef) and node.name == "ShotService")
    isolated = ast.fix_missing_locations(ast.Module(body=[service_node], type_ignores=[]))
    namespace = {
        "AsyncSession": object,
        "ShotCreate": object,
        "ShotPatch": object,
        "Shot": _Shot,
        "select": lambda model: _Select(),
        "NotFoundError": LookupError,
        "ConflictError": _ConflictError,
        "datetime": datetime,
        "timezone": timezone,
    }
    exec(compile(isolated, str(source), "exec"), namespace)
    return namespace["ShotService"]


class ShotServicePatchContractTest(unittest.TestCase):
    def test_system_owned_fields_and_relationships_cannot_be_patched(self):
        shot = _Shot()
        db = _Session(shot)
        request = SimpleNamespace(revision=3, changes={
            "id": "other-shot",
            "production_id": "other-production",
            "created_by": "attacker",
            "created_at": datetime(2030, 1, 1, tzinfo=timezone.utc),
            "updated_at": datetime(2030, 1, 1, tzinfo=timezone.utc),
            "deleted_at": datetime(2030, 1, 1, tzinfo=timezone.utc),
            "sort_index": 1.0,
            "current_version": 99,
            "revision": 99,
            "panels": ["forged"],
        })
        result = asyncio.run(_service_class().patch_shot(db, shot.id, request, "editor-1"))
        self.assertIs(result, shot)
        self.assertEqual((shot.id, shot.production_id, shot.created_by),
                         ("shot-1", "production-1", "creator-1"))
        self.assertEqual((shot.revision, shot.current_version, shot.sort_index), (3, 1, 1000.0))
        self.assertIsNone(shot.deleted_at)
        self.assertEqual(shot.panels, [])
        self.assertEqual(db.flush_count, 0)

    def test_editable_field_increments_revision_once_and_stale_edit_conflicts(self):
        shot = _Shot()
        db = _Session(shot)
        service = _service_class()
        request = SimpleNamespace(revision=3, changes={"name": "Revised", "created_by": "attacker"})
        result = asyncio.run(service.patch_shot(db, shot.id, request, "editor-1"))
        self.assertIs(result, shot)
        self.assertEqual((shot.name, shot.created_by, shot.revision), ("Revised", "creator-1", 4))
        self.assertEqual(db.flush_count, 1)
        with self.assertRaises(_ConflictError) as conflict:
            asyncio.run(service.patch_shot(db, shot.id, request, "editor-2"))
        self.assertEqual(conflict.exception.details, {"server_revision": 4, "client_revision": 3})
        self.assertEqual(db.flush_count, 1)


if __name__ == "__main__":
    unittest.main()
