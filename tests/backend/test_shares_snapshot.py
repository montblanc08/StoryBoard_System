"""The public share snapshot keeps its display contract after ORM mapping."""

import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "api"))

from main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.production import Production
from app.models.shot import Shot
from app.models.user import User


@pytest.fixture
async def share_client(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'shares.db').as_posix()}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with sessions() as session:
        session.add(User(id="share-user", email="share@example.invalid", password_hash="unused", is_active=True))
        session.add(Production(id="share-production", name="Storyboard", created_by="share-user"))
        session.add(Shot(
            id="share-shot", production_id="share-production", display_number="001",
            sort_index=1000, voice_over="旁白文本", dialogue="对话文本",
            camera_movement={"type": "横摇", "speed": "slow"},
        ))
        await session.commit()

    async def isolated_db():
        async with sessions() as session:
            yield session
            await session.commit()

    app.dependency_overrides[get_db] = isolated_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, sessions
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.asyncio
async def test_share_publishes_frozen_voiceover_and_movement_strings(share_client):
    client, sessions = share_client
    path = "/api/v1/productions/share-production/share"
    assert (await client.post(path, json={})).status_code == 401

    token = create_access_token({"sub": "share-user"})
    published = await client.post(
        path, json={"allow_download": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert published.status_code == 201
    public_path = f"/api/v1/share/{published.json()['token']}"
    snapshot_response = await client.get(public_path)
    assert snapshot_response.status_code == 200
    snapshot = snapshot_response.json()
    assert snapshot["allow_download"] is False
    assert snapshot["shots"][0]["voiceover"] == "旁白文本"
    assert snapshot["shots"][0]["movement"] == "横摇"

    async with sessions() as session:
        shot = await session.get(Shot, "share-shot")
        shot.voice_over = "后续修改"
        shot.camera_movement = {"type": "推镜"}
        await session.commit()

    assert (await client.get(public_path)).json() == snapshot
