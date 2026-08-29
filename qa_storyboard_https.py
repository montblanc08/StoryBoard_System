import base64
import getpass
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed


BASE = "https://storyboard.hatsuneuua.top/"
USER = "storyboard"
CTX = ssl.create_default_context()


def request(path, auth=None, method="GET"):
    encoded_path = urllib.parse.quote(path, safe="/?:=&")
    req = urllib.request.Request(BASE + encoded_path, method=method)
    if auth:
        req.add_header("Authorization", "Basic " + auth)
    return urllib.request.urlopen(req, timeout=20, context=CTX)


password = getpass.getpass("Storyboard access password: ")
auth = base64.b64encode(f"{USER}:{password}".encode()).decode()

try:
    request("", method="HEAD")
    unauthenticated_status = 200
except urllib.error.HTTPError as exc:
    unauthenticated_status = exc.code

with request("", auth=auth) as response:
    index = response.read().decode("utf-8")
    index_status = response.status
    hsts = response.headers.get("Strict-Transport-Security", "")

with request("shots-data.js", auth=auth) as response:
    shots_js = response.read().decode("utf-8")
    shots_status = response.status

with request("app.js", auth=auth) as response:
    app_status = response.status
    app_bytes = len(response.read())

with request("styles.css", auth=auth) as response:
    styles_status = response.status
    styles_bytes = len(response.read())

payload = re.sub(r"^\s*window\.STORYBOARD_SHOTS\s*=\s*", "", shots_js)
payload = re.sub(r";\s*$", "", payload)
shots = json.loads(payload)
image_paths = [shot["image"] for shot in shots]


def check_image(path):
    with request(path, auth=auth, method="HEAD") as response:
        return path, response.status, response.headers.get("Content-Type", ""), int(response.headers.get("Content-Length", "0"))


images = []
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(check_image, path) for path in image_paths]
    for future in as_completed(futures):
        images.append(future.result())

bad_images = [item for item in images if item[1] != 200 or not item[2].startswith("image/") or item[3] <= 0]
total_duration = sum(float(shot.get("duration", 0)) for shot in shots)

print(json.dumps({
    "unauthenticated_status": unauthenticated_status,
    "authenticated_index_status": index_status,
    "shots_data_status": shots_status,
    "app_js_status": app_status,
    "styles_css_status": styles_status,
    "hsts": hsts,
    "index_has_title": "天津国际农产品交易中心" in index,
    "shot_count": len(shots),
    "total_duration_seconds": total_duration,
    "image_count": len(images),
    "bad_image_count": len(bad_images),
    "bad_images": bad_images[:10],
    "app_js_bytes": app_bytes,
    "styles_css_bytes": styles_bytes,
}, ensure_ascii=False, indent=2))
