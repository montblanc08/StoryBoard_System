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



@pytest.mark.asyncio
async def test_custom_field_definition_update_is_revision_safe_and_preserves_used_select_options():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={
            "email": settings.INITIAL_ADMIN_EMAIL,
            "password": settings.INITIAL_ADMIN_PASSWORD,
        })
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        production = await client.post("/api/v1/productions", headers=headers, json={
            "name": "Field Definition Update Contract",
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
                "name": "Select field shot",
                "description": "Definition update",
            },
        )
        assert shot.status_code == 201
        shot_id = shot.json()["id"]
        assert shot.json()["revision"] == 1

        created = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
            json={
                "key": "location_status",
                "label": "场地状态",
                "description": "初始说明",
                "field_type": "select",
                "options": ["待定", "已确认"],
                "required": False,
            },
        )
        assert created.status_code == 201
        field = created.json()
        assert field["revision"] == 1
        assert field["options"] == ["待定", "已确认"]

        updated = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}",
            headers=headers,
            json={
                "revision": 1,
                "label": "场地确认状态",
                "description": "供制片与导演统一填写",
                "options": ["待定", "已确认", "驳回"],
                "required": True,
            },
        )
        assert updated.status_code == 200
        updated_field = updated.json()
        assert updated_field["revision"] == 2
        assert updated_field["label"] == "场地确认状态"
        assert updated_field["description"] == "供制片与导演统一填写"
        assert updated_field["options"] == ["待定", "已确认", "驳回"]
        assert updated_field["required"] is True
        assert updated_field["key"] == "location_status"
        assert updated_field["field_type"] == "select"

        stale_update = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}",
            headers=headers,
            json={"revision": 1, "label": "过期客户端修改"},
        )
        assert stale_update.status_code == 409
        assert stale_update.json()["error"]["code"] == "CUSTOM_FIELD_REVISION_CONFLICT"

        value_write = await client.patch(
            f"/api/v1/shots/{shot_id}/custom-fields/{field['id']}",
            headers=headers,
            json={"revision": 1, "value": "已确认"},
        )
        assert value_write.status_code == 200
        assert value_write.json()["revision"] == 2

        remove_used_option = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}",
            headers=headers,
            json={
                "revision": 2,
                "options": ["待定", "驳回"],
            },
        )
        assert remove_used_option.status_code == 400
        assert remove_used_option.json()["error"]["code"] == "FIELD_OPTION_IN_USE"

        rejected_snapshot = await client.get(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
        )
        assert rejected_snapshot.status_code == 200
        rejected_field = next(
            item for item in rejected_snapshot.json() if item["id"] == field["id"]
        )
        assert rejected_field["revision"] == 2
        assert rejected_field["options"] == ["待定", "已确认", "驳回"]

        # select -> text is safe because every persisted value is already a
        # string. The definition changes, but Shot data/revision is untouched.
        type_change = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{field['id']}",
            headers=headers,
            json={
                "revision": 2,
                "field_type": "text",
            },
        )
        assert type_change.status_code == 200
        assert type_change.json()["revision"] == 3
        assert type_change.json()["field_type"] == "text"
        assert type_change.json()["options"] == []

        numeric_text = await client.post(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
            json={
                "key": "numeric_text",
                "label": "数字文本",
                "field_type": "text",
            },
        )
        assert numeric_text.status_code == 201
        numeric_field = numeric_text.json()

        numeric_value = await client.patch(
            f"/api/v1/shots/{shot_id}/custom-fields/{numeric_field['id']}",
            headers=headers,
            json={"revision": 2, "value": "12"},
        )
        assert numeric_value.status_code == 200
        assert numeric_value.json()["revision"] == 3

        unsafe_type_change = await client.patch(
            f"/api/v1/productions/{production_id}/custom-fields/{numeric_field['id']}",
            headers=headers,
            json={
                "revision": 1,
                "field_type": "number",
            },
        )
        assert unsafe_type_change.status_code == 400
        assert (
            unsafe_type_change.json()["error"]["code"]
            == "FIELD_TYPE_VALUE_MIGRATION_REQUIRED"
        )

        fields_after = await client.get(
            f"/api/v1/productions/{production_id}/custom-fields",
            headers=headers,
        )
        assert fields_after.status_code == 200
        persisted = next(item for item in fields_after.json() if item["id"] == field["id"])
        assert persisted["revision"] == 3
        assert persisted["field_type"] == "text"
        assert persisted["options"] == []
        numeric_persisted = next(
            item for item in fields_after.json() if item["id"] == numeric_field["id"]
        )
        assert numeric_persisted["revision"] == 1
        assert numeric_persisted["field_type"] == "text"
