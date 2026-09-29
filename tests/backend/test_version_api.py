"""Integration coverage for canonical Shot version snapshots."""
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from main import app
from app.core.config import settings
from app.core.database import Base, AsyncSessionLocal, async_engine
from app.services.seed import seed_database


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_database(session)
        await session.commit()
    yield


@pytest.mark.asyncio
async def test_version_snapshot_accept_restore_and_noop_restore():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={
            "email": settings.INITIAL_ADMIN_EMAIL,
            "password": settings.INITIAL_ADMIN_PASSWORD,
        })
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        production = await client.post("/api/v1/productions", headers=headers, json={
            "name": "Version Contract",
            "template_type": "film",
            "fps_num": 24,
            "aspect_ratio": "16:9",
        })
        assert production.status_code == 201
        production_id = production.json()["id"]

        shot = await client.post(
            f"/api/v1/productions/{production_id}/shots",
            headers=headers,
            json={
                "display_number": "001",
                "name": "Original",
                "description": "First state",
                "lens_mm": 35,
            },
        )
        assert shot.status_code == 201
        shot_id = shot.json()["id"]

        v1_res = await client.post(
            f"/api/v1/shots/{shot_id}/versions",
            headers=headers,
            json={"name": "First approved candidate", "branch_name": "main"},
        )
        assert v1_res.status_code == 201
        v1 = v1_res.json()
        assert v1["version_number"] == 1
        assert v1["branch_name"] == "main"
        assert v1["parent_version_id"] is None

        version_detail = await client.get(
            f"/api/v1/versions/{v1['id']}",
            headers=headers,
        )
        assert version_detail.status_code == 200
        assert version_detail.json()["snapshot"]["name"] == "Original"
        assert version_detail.json()["snapshot"]["description"] == "First state"
        assert version_detail.json()["snapshot"]["lens_mm"] == 35

        changed = await client.patch(
            f"/api/v1/shots/{shot_id}",
            headers=headers,
            json={
                "revision": 1,
                "changes": {
                    "name": "Changed",
                    "description": "Second state",
                    "lens_mm": 85,
                },
            },
        )
        assert changed.status_code == 200
        assert changed.json()["revision"] == 2

        v2_res = await client.post(
            f"/api/v1/shots/{shot_id}/versions",
            headers=headers,
            json={"name": "Second candidate", "branch_name": "main"},
        )
        assert v2_res.status_code == 201
        v2 = v2_res.json()
        assert v2["version_number"] == 2
        assert v2["parent_version_id"] == v1["id"]

        accepted = await client.post(
            f"/api/v1/versions/{v1['id']}/accept",
            headers=headers,
        )
        assert accepted.status_code == 200
        assert accepted.json()["is_accepted"] is True
        assert accepted.json()["status"] == "Accepted"

        compare_before_restore = await client.get(
            f"/api/v1/versions/{v1['id']}/compare",
            headers=headers,
        )
        assert compare_before_restore.status_code == 200
        compare_body = compare_before_restore.json()
        assert compare_body["current_revision"] == 2
        assert compare_body["changed_count"] >= 3
        compare_fields = {field["key"]: field for field in compare_body["fields"]}
        assert compare_fields["name"] == {
            "key": "name",
            "label": "镜头标题",
            "before": "Original",
            "after": "Changed",
            "changed": True,
        }
        assert compare_fields["description"]["before"] == "First state"
        assert compare_fields["description"]["after"] == "Second state"
        assert compare_fields["lens_mm"]["before"] == 35
        assert compare_fields["lens_mm"]["after"] == 85

        stale_restore = await client.post(
            f"/api/v1/versions/{v1['id']}/restore",
            headers=headers,
            json={"revision": 1},
        )
        assert stale_restore.status_code == 409
        assert stale_restore.json()["error"]["code"] == "SHOT_REVISION_CONFLICT"

        restored = await client.post(
            f"/api/v1/versions/{v1['id']}/restore",
            headers=headers,
            json={"revision": 2},
        )
        assert restored.status_code == 200
        restored_body = restored.json()
        assert restored_body["changed"] is True
        assert restored_body["revision"] == 3
        assert restored_body["backup_version_id"]

        current = await client.get(
            f"/api/v1/productions/{production_id}/shots",
            headers=headers,
        )
        assert current.status_code == 200
        current_shot = current.json()[0]
        assert current_shot["name"] == "Original"
        assert current_shot["description"] == "First state"
        assert current_shot["lens_mm"] == 35
        assert current_shot["revision"] == 3

        versions = await client.get(
            f"/api/v1/shots/{shot_id}/versions",
            headers=headers,
        )
        assert versions.status_code == 200
        version_rows = versions.json()
        assert [row["version_number"] for row in version_rows] == [3, 2, 1]
        assert version_rows[0]["name"] == "回滚前备份"

        noop_restore = await client.post(
            f"/api/v1/versions/{v1['id']}/restore",
            headers=headers,
            json={"revision": 3},
        )
        assert noop_restore.status_code == 200
        assert noop_restore.json() == {
            "changed": False,
            "shot_id": shot_id,
            "revision": 3,
            "restored_version_id": v1["id"],
            "backup_version_id": None,
        }

        branch_res = await client.post(
            f"/api/v1/shots/{shot_id}/branches",
            headers=headers,
            json={
                "branch_name": "alternate-cut",
                "name": "Alternate cut from v2",
                "parent_version_id": v2["id"],
            },
        )
        assert branch_res.status_code == 201
        branch = branch_res.json()
        assert branch["version_number"] == 4
        assert branch["branch_name"] == "alternate-cut"
        assert branch["parent_version_id"] == v2["id"]

        stale_merge = await client.post(
            f"/api/v1/versions/{branch['id']}/merge",
            headers=headers,
            json={"revision": 2, "branch_name": "main"},
        )
        assert stale_merge.status_code == 409
        assert stale_merge.json()["error"]["code"] == "SHOT_REVISION_CONFLICT"

        merged = await client.post(
            f"/api/v1/versions/{branch['id']}/merge",
            headers=headers,
            json={"revision": 3, "branch_name": "main"},
        )
        assert merged.status_code == 200
        merged_body = merged.json()
        assert merged_body["changed"] is True
        assert merged_body["revision"] == 4
        assert merged_body["merged_version_id"] == branch["id"]
        assert merged_body["backup_version_id"]

        current_after_merge = await client.get(
            f"/api/v1/productions/{production_id}/shots",
            headers=headers,
        )
        assert current_after_merge.status_code == 200
        merged_shot = current_after_merge.json()[0]
        assert merged_shot["name"] == "Changed"
        assert merged_shot["description"] == "Second state"
        assert merged_shot["lens_mm"] == 85
        assert merged_shot["revision"] == 4

        versions_after_merge = await client.get(
            f"/api/v1/shots/{shot_id}/versions",
            headers=headers,
        )
        assert versions_after_merge.status_code == 200
        merged_versions = versions_after_merge.json()
        assert [row["version_number"] for row in merged_versions] == [5, 4, 3, 2, 1]
        merge_backup = merged_versions[0]
        assert merge_backup["name"] == "合并前备份"
        assert merge_backup["merge_parent_id"] == branch["id"]