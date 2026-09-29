"""Integration coverage for custom-field archive/purge tombstone semantics."""
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
async def test_custom_field_archive_restore_purge_is_irreversible_and_scrubs_saved_views():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={
            "email": settings.INITIAL_ADMIN_EMAIL,
            "password": settings.INITIAL_ADMIN_PASSWORD,
        })
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        production = await client.post("/api/v1/productions", headers=headers, json={
            "name": "Field Lifecycle Contract",
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
                "name": "Custom field shot",
                "description": "Field lifecycle",
            },
        )
        assert shot.status_code == 201
        shot_id = shot.json()["id"]
        assert shot.json()["revision"] == 1

        created = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
            json={
                "key": "location_note",
                "label": "场地备注",
                "field_type": "text",
            },
        )
        assert created.status_code == 201
        field = created.json()
        assert field["key"] == "location_note"
        assert field["column_key"] == "custom:location_note"
        assert field["state"] == "visible"
        assert field["permanently_deleted"] is False
        assert field["revision"] == 1

        value_write = await client.patch(
            f"/api/v1/shots/{shot_id}/custom-fields/{field['id']}",
            headers=headers,
            json={"revision": 1, "value": "天津外景"},
        )
        assert value_write.status_code == 200
        assert value_write.json()["changed"] is True
        assert value_write.json()["revision"] == 2

        no_op = await client.patch(
            f"/api/v1/shots/{shot_id}/custom-fields/{field['id']}",
            headers=headers,
            json={"revision": 2, "value": "天津外景"},
        )
        assert no_op.status_code == 200
        assert no_op.json()["changed"] is False
        assert no_op.json()["revision"] == 2

        matrix = await client.get(
            f"/api/v1/productions/{production_id}/custom-field-values",
            headers=headers,
        )
        assert matrix.status_code == 200
        assert matrix.json()["values"][shot_id][field["id"]] == "天津外景"

        saved_view = await client.post(
            f"/api/v1/productions/{production_id}/saved-views",
            headers=headers,
            json={
                "name": "Custom column view",
                "view_type": "table",
                "is_shared": True,
                "config": {
                    "presentation": {
                        "columnOrder": [
                            "description",
                            "custom:location_note",
                            "status",
                        ],
                        "hiddenColumns": ["custom:location_note"],
                        "columnWidths": {
                            "description": 260,
                            "custom:location_note": 210,
                        },
                    },
                    "customColumns": {
                        "order": ["custom:location_note"],
                        "hidden": [],
                        "widths": {"custom:location_note": 210},
                    },
                    "sort": {
                        "key": "custom:location_note",
                        "direction": "desc",
                    },
                },
            },
        )
        assert saved_view.status_code == 201
        saved_view_id = saved_view.json()["id"]

        archived = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}/state",
            headers=headers,
            json={"revision": 1, "state": "removed"},
        )
        assert archived.status_code == 200
        archived_field = archived.json()
        assert archived_field["state"] == "removed"
        assert archived_field["revision"] == 2

        blocked_write = await client.patch(
            f"/api/v1/shots/{shot_id}/custom-fields/{field['id']}",
            headers=headers,
            json={"revision": 2, "value": "不应该写入"},
        )
        assert blocked_write.status_code == 400
        assert blocked_write.json()["error"]["code"] == "FIELD_ARCHIVED"

        restored = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}/state",
            headers=headers,
            json={"revision": 2, "state": "visible"},
        )
        assert restored.status_code == 200
        assert restored.json()["state"] == "visible"
        assert restored.json()["revision"] == 3

        archived_again = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}/state",
            headers=headers,
            json={"revision": 3, "state": "removed"},
        )
        assert archived_again.status_code == 200
        assert archived_again.json()["revision"] == 4

        stale_purge = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}/purge",
            headers=headers,
            json={"revision": 3},
        )
        assert stale_purge.status_code == 409
        assert stale_purge.json()["error"]["code"] == "CUSTOM_FIELD_REVISION_CONFLICT"

        purged = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}/purge",
            headers=headers,
            json={"revision": 4},
        )
        assert purged.status_code == 200
        assert purged.json() == {"ok": True, "purged": True}

        fields_after = await client.get(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
        )
        assert fields_after.status_code == 200
        assert fields_after.json() == []

        values_after = await client.get(
            f"/api/v1/productions/{production_id}/custom-field-values",
            headers=headers,
        )
        assert values_after.status_code == 200
        assert values_after.json() == {"values": {}}

        # Permanent tombstone: an old/new client cannot recreate the same key.
        recreate = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
            json={
                "key": "location_note",
                "label": "场地备注复活",
                "field_type": "text",
            },
        )
        assert recreate.status_code == 400
        assert recreate.json()["error"]["code"] == "FIELD_KEY_PURGED"

        # Purge also rewrites server Saved Views so stale layouts cannot revive
        # the deleted key even before the browser applies field-catalogue filtering.
        views_after = await client.get(
            f"/api/v1/productions/{production_id}/saved-views",
            headers=headers,
        )
        assert views_after.status_code == 200
        view = next(item for item in views_after.json() if item["id"] == saved_view_id)
        config = view["config"]
        assert "custom:location_note" not in config["presentation"]["columnOrder"]
        assert "custom:location_note" not in config["presentation"]["hiddenColumns"]
        assert "custom:location_note" not in config["presentation"]["columnWidths"]
        assert "custom:location_note" not in config["customColumns"]["order"]
        assert "custom:location_note" not in config["customColumns"]["widths"]
        assert config["sort"] == {"key": "default", "direction": "asc"}
        assert view["revision"] == 2
