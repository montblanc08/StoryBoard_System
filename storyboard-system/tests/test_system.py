#!/usr/bin/env python3
"""Comprehensive test suite for FrameForge V3.0 Master Specification."""

import http.cookiejar
import importlib.util
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path


class FrameForgeSystemTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        os.environ["STORYBOARD_DATA_ROOT"] = cls.temp.name
        os.environ["STORYBOARD_ADMIN_USER"] = "qa-admin"
        os.environ["STORYBOARD_ADMIN_PASSWORD"] = "FrameForge2026!QA"

        path = Path(__file__).resolve().parents[1] / "server.py"
        spec = importlib.util.spec_from_file_location("storyboard_server", path)
        cls.app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.app)
        cls.app.init_db()

        cls.httpd = cls.app.ThreadingHTTPServer(("127.0.0.1", 0), cls.app.AppHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_port}"

        jar = http.cookiejar.CookieJar()
        cls.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.temp.cleanup()

    def request(self, path, method="GET", data=None, csrf=None, content_type="application/json"):
        body = json.dumps(data).encode("utf-8") if isinstance(data, (dict, list)) else data
        headers = {"Content-Type": content_type}
        if csrf:
            headers["X-CSRF-Token"] = csrf
        req = urllib.request.Request(self.base + path, body, headers, method=method)
        with self.client.open(req) as res:
            raw = res.read()
            return res.status, json.loads(raw) if "json" in res.headers.get("Content-Type", "") else raw

    # 1. SMPTE Timecode Unit Tests (Spec Section 19-22)
    def test_smpte_timecode_engine(self):
        # 25 fps non-drop frame
        tc = self.app.frames_to_tc(75, 25.0)
        self.assertEqual(tc, "00:00:03:00")
        frames = self.app.tc_to_frames("01:00:03:12", 25.0)
        self.assertEqual(frames, 90087)

        # 24 fps
        tc_24 = self.app.frames_to_tc(48, 24.0)
        self.assertEqual(tc_24, "00:00:02:00")

        # 29.97 Drop-Frame calculation (SMPTE standard)
        tc_df = self.app.frames_to_tc(1800, 29.97, is_drop_frame=True)
        self.assertTrue(";" in tc_df)

    # 2. VO Auto-Timing Engine Tests (Spec Section 23-30)
    def test_vo_auto_timing_calculation(self):
        shots = [
            {"id": "s1", "voiceover": "渤海潮涌，津门向新！", "locked": False, "duration_frames": 75},
            {"id": "s2", "voiceover": "千年商脉奔流不息，时代浪潮浩荡向前。", "locked": False, "duration_frames": 75},
            {"id": "s3", "voiceover": "产品展示镜头", "locked": True, "duration_frames": 50}
        ]
        # Target 10.0s @ 25fps = 250 frames. Locked = 50f. Unlocked remainder = 200f.
        result = self.app.compute_auto_timing(shots, 10.0, 25.0)
        self.assertEqual(result[2]["duration_frames"], 50)  # Locked preserved
        total_frames = sum(s["duration_frames"] for s in result)
        self.assertEqual(total_frames, 250)  # Exact frames budget
        # s2 has more text & punctuation than s1 -> should get more frames
        self.assertGreater(result[1]["duration_frames"], result[0]["duration_frames"])

    # 3. Complete Production API Workflow
    def test_complete_production_workflow(self):
        # Login
        status, session = self.request("/api/login", "POST", {
            "username": "qa-admin",
            "password": "FrameForge2026!QA"
        })
        self.assertEqual(status, 200)
        csrf = session["csrf"]

        # Create Project
        status, bundle = self.request("/api/projects", "POST", {
            "name": "QA TVC Commercial",
            "production_type": "tvc",
            "fps": 25.0,
            "target_seconds": 30.0,
            "aspect_ratio": "16:9"
        }, csrf)
        self.assertEqual(status, 201)
        pid = bundle["project"]["id"]
        self.assertEqual(bundle["project"]["production_type"], "tvc")

        # Update Shots with Production Methods
        shots = bundle["shots"]
        shots[0]["primary_method"] = "STOCK"
        shots[0]["title"] = "日出素材采购"
        shots[0]["voiceover"] = "晨光破晓，万物复苏。"

        shots[1]["primary_method"] = "LIVE"
        shots[1]["title"] = "车队现场拍摄"
        shots[1]["shot_size"] = "特写"
        shots[1]["lens"] = "85mm"

        shots[2]["primary_method"] = "AE"
        shots[2]["title"] = "地图线路包装"

        status, saved = self.request(f"/api/projects/{pid}/shots", "PUT", {"shots": shots}, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(saved["shots"][0]["primary_method"], "STOCK")
        self.assertEqual(saved["shots"][1]["lens"], "85mm")

        # Auto Timing API
        status, timed = self.request(f"/api/projects/{pid}/auto-timing", "POST", {}, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(timed["total_frames"], 750)  # 30s * 25fps = 750f

        # Add Comment
        sid = saved["shots"][0]["id"]
        status, c_res = self.request(f"/api/shots/{sid}/comments", "POST", {
            "text": "镜头建议换成黄昏日落素材",
            "role": "Director"
        }, csrf)
        self.assertEqual(status, 201)

        # Anonymous Share Publish
        status, share_res = self.request(f"/api/projects/{pid}/share", "POST", {
            "is_permanent": True,
            "allow_download": True
        }, csrf)
        self.assertEqual(status, 200)
        token = share_res["token"]

        # Public Anonymous Access (Zero login required)
        status, public_data = self.request(f"/api/shares/{token}")
        self.assertEqual(status, 200)
        self.assertEqual(len(public_data["bundle"]["shots"]), len(shots))

        # Deliverables Exporters
        status, edl_raw = self.request(f"/api/projects/{pid}/export/edl", "GET", None, csrf)
        self.assertEqual(status, 200)
        self.assertIn("TITLE:", edl_raw.decode("utf-8") if isinstance(edl_raw, bytes) else str(edl_raw))

        status, otio_data = self.request(f"/api/projects/{pid}/export/otio", "GET", None, csrf)
        self.assertEqual(status, 200)
        otio_json = otio_data if isinstance(otio_data, dict) else json.loads(otio_data.decode("utf-8"))
        self.assertEqual(otio_json["OTIO_SCHEMA"], "Timeline.1")

        status, srt_raw = self.request(f"/api/projects/{pid}/export/srt", "GET", None, csrf)
        self.assertEqual(status, 200)
        self.assertIn("-->", srt_raw.decode("utf-8-sig") if isinstance(srt_raw, bytes) else str(srt_raw))

        status, csv_raw = self.request(f"/api/projects/{pid}/export/shooting_list", "GET", None, csrf)
        self.assertEqual(status, 200)
        self.assertTrue(len(csv_raw) > 0)

    # 4. Excel Import Header Confidence Mapping
    def test_excel_header_mapping(self):
        headers = ["镜号", "画面描述", "旁白", "制作方式", "景别", "焦段", "时长"]
        mapping = self.app.map_headers(headers)
        self.assertIn("number", mapping)
        self.assertIn("description", mapping)
        self.assertIn("voiceover", mapping)
        self.assertIn("primary_method", mapping)
        self.assertGreaterEqual(mapping["number"]["confidence"], 0.9)


if __name__ == "__main__":
    unittest.main(verbosity=2)
