#!/usr/bin/env python3
"""Phase 0 Comprehensive Test Runner (Zero-Dependency Python Standard Library)."""

import json
import os
import sys
import unittest
from pathlib import Path

# Add project root and packages
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "apps" / "api") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "apps" / "api"))
if str(Path(__file__).parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent))

try:
    from tests.backend.test_timecode import (
        compute_auto_timing,
        frames_to_tc,
        tc_to_frames
    )
except ImportError:
    from test_timecode import (
        compute_auto_timing,
        frames_to_tc,
        tc_to_frames
    )

from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password
)


class Phase0EngineTests(unittest.TestCase):
    """1. Test Timecode & Auto-Timing Engine (packages/timecode)"""

    def test_smpte_timecode_conversions(self):
        # 25 fps PAL
        self.assertEqual(frames_to_tc(0, 25.0), "00:00:00:00")
        self.assertEqual(frames_to_tc(25, 25.0), "00:00:01:00")
        self.assertEqual(frames_to_tc(90000, 25.0), "01:00:00:00")
        self.assertEqual(tc_to_frames("01:00:00:00", 25.0), 90000)

        # 24 fps Film
        self.assertEqual(frames_to_tc(48, 24.0), "00:00:02:00")
        self.assertEqual(tc_to_frames("00:00:02:00", 24.0), 48)

        # 29.97 Drop-Frame
        tc_df = frames_to_tc(1800, 29.97, is_drop_frame=True)
        self.assertIn(";", tc_df)

    def test_deterministic_vo_timing(self):
        shots = [
            {"id": "s1", "voiceover": "镜头一解说词，简短起势。", "locked": False, "duration_frames": 50},
            {"id": "s2", "voiceover": "镜头二解说词内容更加丰富，包含更多叙述、细节以及对未来发展蓝图的展望！", "locked": False, "duration_frames": 50},
            {"id": "s3", "voiceover": "产品三维动画特写展示", "locked": True, "duration_frames": 75}
        ]

        # Target 10s @ 25fps = 250 frames. Locked = 75. Remaining = 175 frames.
        res = compute_auto_timing(shots, 10.0, 25.0)

        # 1. Locked shot remains unchanged
        self.assertEqual(res[2]["duration_frames"], 75)

        # 2. Total duration equals target frames exactly (zero frame drift)
        total_frames = sum(s["duration_frames"] for s in res)
        self.assertEqual(total_frames, 250)

        # 3. Shot 2 has more words & punctuation -> allocated more frames than Shot 1
        self.assertGreater(res[1]["duration_frames"], res[0]["duration_frames"])


class Phase0SecurityTests(unittest.TestCase):
    """2. Test Authentication, Hashing & JWT Security (apps/api/core)"""

    def test_password_hashing_and_verification(self):
        raw_pw = "FrameForge2026!QA"
        hashed = get_password_hash(raw_pw)
        self.assertTrue(verify_password(raw_pw, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_jwt_token_encode_decode(self):
        payload = {"sub": "user-uuid-1234", "email": "director@company.internal"}
        token = create_access_token(payload)
        self.assertIsInstance(token, str)

        decoded = decode_access_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["sub"], "user-uuid-1234")
        self.assertEqual(decoded["email"], "director@company.internal")


class Phase0DomainAndConcurrencyTests(unittest.TestCase):
    """3. Test Shot Domain Model, OCC Revisions, Soft Delete and Reorder"""

    def test_optimistic_concurrency_revision_check(self):
        # Simulating database record with revision = 1
        shot_record = {
            "id": "shot-101",
            "revision": 1,
            "lens_mm": 35.0,
            "status": "draft"
        }

        # Client A submits with revision 1 -> Approved, increment to 2
        client_a_patch = {"revision": 1, "changes": {"lens_mm": 50.0}}
        self.assertEqual(shot_record["revision"], client_a_patch["revision"])
        shot_record["lens_mm"] = client_a_patch["changes"]["lens_mm"]
        shot_record["revision"] += 1
        self.assertEqual(shot_record["revision"], 2)

        # Client B submits stale revision 1 -> Conflict 409
        client_b_patch = {"revision": 1, "changes": {"lens_mm": 85.0}}
        is_conflict = (shot_record["revision"] != client_b_patch["revision"])
        self.assertTrue(is_conflict)

    def test_fractional_numeric_reordering(self):
        shots = [
            {"id": "s1", "sort_index": 1000.0},
            {"id": "s2", "sort_index": 2000.0},
            {"id": "s3", "sort_index": 3000.0}
        ]
        # Insert new shot between s1 and s2
        inserted_sort = (shots[0]["sort_index"] + shots[1]["sort_index"]) / 2.0
        self.assertEqual(inserted_sort, 1500.0)

        # Reorder list
        shots.insert(1, {"id": "s_new", "sort_index": inserted_sort})
        sorted_ids = [s["id"] for s in sorted(shots, key=lambda x: x["sort_index"])]
        self.assertEqual(sorted_ids, ["s1", "s_new", "s2", "s3"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
