#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE="/root/storyboard-deploy-20260828.tar.gz"
EXPECTED_SHA256="63175f5f231a9f6f960cb21c4bf4f3212869fea229259e95db9acbb5fcacf617"
SITE_ROOT="/var/www/storyboard"
CADDYFILE="/etc/caddy/Caddyfile"
HOSTNAME="storyboard.hatsuneuua.top"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE="/var/www/.storyboard-stage-${STAMP}"
BACKUP_ROOT="/var/backups/storyboard"
CADDY_BACKUP="${BACKUP_ROOT}/Caddyfile.${STAMP}"
SITE_BACKUP="${BACKUP_ROOT}/site.${STAMP}"
SITE_MOVED=0
CADDY_CHANGED=0

rollback() {
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "Deployment failed; rolling back." >&2
    if [ "$CADDY_CHANGED" -eq 1 ] && [ -f "$CADDY_BACKUP" ]; then
      cp -a "$CADDY_BACKUP" "$CADDYFILE"
      caddy validate --config "$CADDYFILE" >/dev/null 2>&1 || true
      systemctl reload caddy >/dev/null 2>&1 || true
    fi
    if [ "$SITE_MOVED" -eq 1 ] && [ -d "$SITE_BACKUP" ]; then
      if [ -d "$SITE_ROOT" ]; then
        mv "$SITE_ROOT" "${BACKUP_ROOT}/failed-site.${STAMP}"
      fi
      mv "$SITE_BACKUP" "$SITE_ROOT"
    fi
    if [ -d "$STAGE" ]; then
      rm -rf -- "$STAGE"
    fi
  fi
  exit "$code"
}
trap rollback EXIT

test -f "$ARCHIVE"
actual_sha256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
test "$actual_sha256" = "$EXPECTED_SHA256"

install -d -m 0750 "$STAGE" "$BACKUP_ROOT"
tar -xzf "$ARCHIVE" --no-same-owner -C "$STAGE"
test -f "$STAGE/index.html"
test -f "$STAGE/app.js"
test -f "$STAGE/styles.css"
test -f "$STAGE/shots-data.js"
image_count="$(find "$STAGE/images" -maxdepth 1 -type f | wc -l | tr -d ' ')"
test "$image_count" = "80"

cp -a "$CADDYFILE" "$CADDY_BACKUP"
if grep -Fq "$HOSTNAME" "$CADDYFILE"; then
  echo "Caddy already contains ${HOSTNAME}; refusing to create a duplicate." >&2
  exit 1
fi

if [ -d "$SITE_ROOT" ]; then
  mv "$SITE_ROOT" "$SITE_BACKUP"
  SITE_MOVED=1
fi
mv "$STAGE" "$SITE_ROOT"
chown -R root:caddy "$SITE_ROOT"
find "$SITE_ROOT" -type d -exec chmod 0750 {} +
find "$SITE_ROOT" -type f -exec chmod 0640 {} +

cat >> "$CADDYFILE" <<'CADDY_SITE'

storyboard.hatsuneuua.top {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		X-Frame-Options "DENY"
		X-Robots-Tag "noindex, nofollow"
		-Server
	}
	basicauth {
		storyboard $2b$14$MNokbnM.bB/uc7m9Q/IpVeu6vw1vEr7x1QIpMNzh9CI7cZhCHilFS
	}
	root * /var/www/storyboard
	try_files {path} /index.html
	file_server
}
CADDY_SITE
CADDY_CHANGED=1

caddy fmt --overwrite "$CADDYFILE"
caddy validate --config "$CADDYFILE"
systemctl reload caddy
sleep 2
systemctl is-active --quiet caddy

trap - EXIT
echo "DEPLOYED_HOST=${HOSTNAME}"
echo "IMAGE_COUNT=${image_count}"
echo "ARCHIVE_SHA256=${actual_sha256}"
echo "CADDY_BACKUP=${CADDY_BACKUP}"
if [ "$SITE_MOVED" -eq 1 ]; then
  echo "SITE_BACKUP=${SITE_BACKUP}"
fi
