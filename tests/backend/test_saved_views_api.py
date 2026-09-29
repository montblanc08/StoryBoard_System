"""Integration coverage for server-persisted saved views."""
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
async def test_saved_view_crud_is_revision_aware_and_noop_safe():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post("/api/v1/auth/login", json={
            "email": settings.INITIAL_ADMIN_EMAIL,
            "password": settings.INITIAL_ADMIN_PASSWORD,
        })
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        production = await client.post("/api/v1/productions", headers=headers, json={
            "name": "Saved View Contract",
            "template_type": "film",
            "fps_num": 24,
            "aspect_ratio": "16:9",
        })
        assert production.status_code == 201
        production_id = production.json()["id"]

        config = {
            "presentation": {
                "version": 1,
                "columnOrder": ["description", "voice_over", "status"],
                "hiddenColumns": ["owner_id"],
                "columnWidths": {"description": 320},
                "rowHeight": "compact",
            },
            "filters": {
                "searchQuery": "night",
                "primaryMethod": "live",
                "department": "Camera",
                "status": "review",
            },
            "sort": {"key": "description", "direction": "asc"},
        }

        created = await client.post(
            f"/api/v1/productions/{production_id}/saved-views",
            headers=headers,
            json={
                "name": "Director Review",
                "view_type": "table",
                "is_shared": True,
                "config": config,
            },
        )
        assert created.status_code == 201
        view = created.json()
        assert view["name"] == "Director Review"
        assert view["revision"] == 1
        assert view["config"] == config

        listed = await client.get(
            f"/api/v1/productions/{production_id}/saved-views",
            headers=headers,
        )
        assert listed.status_code == 200
        assert [item["id"] for item in listed.json()] == [view["id"]]

        noop = await client.patch(
            f"/api/v1/productions/{production_id}/saved-views/{view['id']}",
            headers=headers,
            json={
                "revision": 1,
                "name": "Director Review",
                "is_shared": True,
                "config": config,
            },
        )
        assert noop.status_code == 200
        assert noop.json()["revision"] == 1

        changed_config = {
            **config,
            "sort": {"key": "status", "direction": "desc"},
        }
        updated = await client.patch(
            f"/api/v1/productions/{production_id}/saved-views/{view['id']}",
            headers=headers,
            json={
                "revision": 1,
                "name": "Director Review v2",
                "config": changed_config,
            },
        )
        assert updated.status_code == 200
        assert updated.json()["revision"] == 2
        assert updated.json()["name"] == "Director Review v2"
        assert updated.json()["config"]["sort"]["key"] == "status"

        stale = await client.patch(
            f"/api/v1/productions/{production_id}/saved-views/{view['id']}",
            headers=headers,
            json={
                "revision": 1,
                "name": "stale",
            },
        )
        assert stale.status_code == 409
        assert stale.json()["error"]["code"] == "SAVED_VIEW_REVISION_CONFLICT"

        deleted = await client.delete(
            f"/api/v1/productions/{production_id}/saved-views/{view['id']}",
            headers=headers,
        )
        assert deleted.status_code == 204

        after_delete = await client.get(
            f"/api/v1/productions/{production_id}/saved-views",
            headers=headers,
        )
        assert after_delete.status_code == 200
        assert after_delete.json() == []
