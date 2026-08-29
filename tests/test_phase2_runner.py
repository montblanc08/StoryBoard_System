"""
FrameForge OS Phase 2 Automated Test Suite
Validates Excel Table Importer, CMX 3600 EDL, OTIO, SRT, Share Snapshots, and AI Provider Contracts.
"""
from __future__ import annotations

import asyncio
import io
import json
import sys
import unittest
from pathlib import Path

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.services.ai_provider import MockAIProvider, provider_registry
from app.services.exporter import (
    generate_cmx3600_edl,
    generate_csv,
    generate_otio,
    generate_srt
)
from app.services.importer import map_headers, parse_csv


class MockShot:
    def __init__(self, num: str, name: str, desc: str, vo: str, dur: int, method: str = "LIVE"):
        self.id = f"shot-{num}"
        self.display_number = num
        self.name = name
        self.description = desc
        self.voiceover = vo
        self.duration_frames = dur
        self.shot_size = "全景"
        self.lens_mm = 50.0
        self.movement = "航拍"
        self.primary_method = method
        self.department = "Camera"
        self.owner_id = "王指导"
        self.status = "approved"
        self.director_notes = "保持画质"


class Phase2ImporterTests(unittest.TestCase):
    def test_header_mapping_aliases(self):
        sample_headers = [
            "镜头编号", "画面描述", "对应旁白", "时长(秒)", "制作方式", "责任部门", "负责人", "焦段"
        ]
        mapping = map_headers(sample_headers)

        self.assertIn("number", mapping)
        self.assertIn("description", mapping)
        self.assertIn("voiceover", mapping)
        self.assertIn("duration", mapping)
        self.assertIn("primary_method", mapping)
        self.assertIn("department", mapping)
        self.assertIn("owner_id", mapping)
        self.assertIn("lens_mm", mapping)

        self.assertEqual(mapping["number"]["col"], 0)
        self.assertEqual(mapping["description"]["col"], 1)
        self.assertEqual(mapping["voiceover"]["col"], 2)

    def test_csv_parser_with_commas_and_newlines(self):
        csv_data = "镜号,画面,旁白\n001,\"海面全景，日出\",天津港启航\n002,\"交易大厅\",智慧结算\n"
        rows = parse_csv(csv_data.encode("utf-8"))
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1][0], "001")
        self.assertEqual(rows[1][1], "海面全景，日出")


class Phase2ExporterTests(unittest.TestCase):
    def setUp(self):
        self.shots = [
            MockShot("001", "渤海海面", "海面航拍推镜头", "渤海之滨，津门故里", 75),
            MockShot("002", "天津港码头", "港口集装箱吊装", "现代化智慧港口", 100),
        ]

    def test_cmx3600_edl_generation(self):
        edl = generate_cmx3600_edl(self.shots, fps=25.0, is_drop_frame=False, title="TJAGRI_TEST")
        self.assertIn("TITLE: TJAGRI_TEST", edl)
        self.assertIn("FCM: NON-DROP FRAME", edl)
        self.assertIn("001  AX       V     C", edl)
        self.assertIn("01:00:00:00 01:00:03:00", edl)
        self.assertIn("002  AX       V     C", edl)
        self.assertIn("01:00:03:00 01:00:07:00", edl)

    def test_srt_subtitles_generation(self):
        srt = generate_srt(self.shots, fps=25.0)
        self.assertIn("1\n00:00:00,000 --> 00:00:03,000\n渤海之滨，津门故里", srt)
        self.assertIn("2\n00:00:03,000 --> 00:00:07,000\n现代化智慧港口", srt)

    def test_otio_json_schema(self):
        otio = generate_otio(self.shots, fps=25.0, title="TJAGRI")
        self.assertEqual(otio["OTIO_SCHEMA"], "Timeline.1")
        tracks = otio["tracks"]["children"]
        self.assertEqual(len(tracks), 1)
        clips = tracks[0]["children"]
        self.assertEqual(len(clips), 2)
        self.assertEqual(clips[0]["source_range"]["duration"]["value"], 75)
        self.assertEqual(clips[1]["source_range"]["duration"]["value"], 100)

    def test_csv_export(self):
        csv_str = generate_csv(self.shots, fps=25.0)
        self.assertTrue(csv_str.startswith("\ufeff"))  # BOM
        self.assertIn("001,渤海海面,LIVE", csv_str)


class Phase2AIProviderContractTests(unittest.TestCase):
    def test_provider_registry_and_mock_execution(self):
        # AI is disabled by default per Master Plan
        self.assertFalse(provider_registry.is_enabled)

        mock_provider = MockAIProvider()
        self.assertEqual(mock_provider.name, "mock-provider-offline")
        self.assertIn("screenplay_breakdown", mock_provider.supported_capabilities)

        # Async execution check
        res = asyncio.run(
            mock_provider.execute_job("screenplay_breakdown", {"text": "场景1：内景 大堂"})
        )
        self.assertEqual(res["status"], "completed")
        self.assertIn("extracted_shots", res["result"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
