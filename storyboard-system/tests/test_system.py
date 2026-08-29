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


class StoryboardSystemTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        os.environ["STORYBOARD_DATA_ROOT"] = cls.temp.name
        os.environ["STORYBOARD_ADMIN_USER"] = "qa-admin"
        os.environ["STORYBOARD_ADMIN_PASSWORD"] = "QA-Password-Only-2026!"
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
        body = json.dumps(data).encode() if isinstance(data, (dict, list)) else data
        headers = {"Content-Type": content_type}
        if csrf:
            headers["X-CSRF-Token"] = csrf
        req = urllib.request.Request(self.base + path, body, headers, method=method)
        with self.client.open(req) as res:
            raw = res.read()
            return res.status, json.loads(raw) if "json" in res.headers.get("Content-Type", "") else raw

    def test_complete_workflow(self):
        status, session = self.request("/api/login", "POST", {"username": "qa-admin", "password": "QA-Password-Only-2026!"})
        self.assertEqual(status, 200)
        csrf = session["csrf"]

        status, bundle = self.request("/api/projects", "POST", {"name": "QA TVC", "production_type": "tvc", "fps": 25, "target_seconds": 15}, csrf)
        self.assertEqual(status, 201)
        pid = bundle["project"]["id"]

        _, shot = self.request(f"/api/projects/{pid}/shots", "POST", {"title": "Hero Shot"}, csrf)
        shot["voiceover"] = "这是一个测试旁白。节奏清晰，信息完整。"
        shot["duration_frames"] = 125
        _, saved = self.request(f"/api/projects/{pid}/shots", "PUT", {"shots": [shot]}, csrf)
        self.assertEqual(saved["shots"][0]["duration_frames"], 125)

        csv_body = "镜号,场景/地点,画面描述,对应旁白,时长（秒）\n002,摄影棚,产品高速摄影,每一帧都清晰可见。,2.5\n".encode("utf-8-sig")
        _, imported = self.request(f"/api/projects/{pid}/import?filename=shots.csv", "POST", csv_body, csrf, "application/octet-stream")
        self.assertEqual(imported["imported"], 1)
        self.assertIn("description", imported["mapping"])

        _, share = self.request(f"/api/projects/{pid}/share", "POST", {}, csrf)
        token = share["token"]
        status, public = self.request(f"/api/shares/{token}")
        self.assertEqual(status, 200)
        self.assertEqual(len(public["shots"]), 2)
        self.assertNotIn("share_token", public["project"])

        status, archive = self.request(f"/api/shares/{token}/download")
        self.assertEqual(status, 200)
        self.assertTrue(archive.startswith(b"PK"))

    def test_login_rate_response(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self.request("/api/login", "POST", {"username": "qa-admin", "password": "wrong"})
        self.assertEqual(ctx.exception.code, 401)


if __name__ == "__main__":
    unittest.main(verbosity=2)
