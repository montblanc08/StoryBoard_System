#!/usr/bin/env bash
set -Eeuo pipefail

CADDYFILE="/etc/caddy/Caddyfile"
SITE_ROOT="/var/www/storyboard"
DEPLOY_ARCHIVE="/root/storyboard-deploy-20260828.tar.gz"
HOSTNAME="storyboard.hatsuneuua.top"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/var/backups/storyboard"
CADDY_BACKUP="${BACKUP_DIR}/Caddyfile.pre-remove.${STAMP}"
CADDY_NEW="/etc/caddy/Caddyfile.storyboard-removal.${STAMP}"

test -f "$CADDYFILE"
grep -Fq "$HOSTNAME" "$CADDYFILE"
test -d "$SITE_ROOT"
test -f "$SITE_ROOT/index.html"
test -f "$DEPLOY_ARCHIVE"

install -d -m 0750 "$BACKUP_DIR"
cp -a "$CADDYFILE" "$CADDY_BACKUP"

awk '
BEGIN { skipping=0; depth=0 }
{
  if (!skipping && $0 ~ /^storyboard\.hatsuneuua\.top[[:space:]]*\{[[:space:]]*$/) {
    skipping=1
    line=$0
    opens=gsub(/\{/, "{", line)
    closes=gsub(/\}/, "}", line)
    depth=opens-closes
    next
  }
  if (skipping) {
    line=$0
    opens=gsub(/\{/, "{", line)
    closes=gsub(/\}/, "}", line)
    depth += opens-closes
    if (depth <= 0) {
      skipping=0
      depth=0
    }
    next
  }
  print
}
END {
  if (skipping || depth != 0) exit 23
}
' "$CADDYFILE" > "$CADDY_NEW"

if grep -Fq "$HOSTNAME" "$CADDY_NEW"; then
  echo "Hostname remains in candidate Caddyfile; aborting." >&2
  exit 1
fi

caddy fmt --overwrite "$CADDY_NEW"
caddy validate --config "$CADDY_NEW"
install -o root -g root -m 0644 "$CADDY_NEW" "$CADDYFILE"
rm -f -- "$CADDY_NEW"
systemctl reload caddy
sleep 2
systemctl is-active --quiet caddy

rm -rf -- "$SITE_ROOT"
rm -f -- "$DEPLOY_ARCHIVE"

test ! -e "$SITE_ROOT"
test ! -e "$DEPLOY_ARCHIVE"
if grep -Fq "$HOSTNAME" "$CADDYFILE"; then
  echo "Hostname still present after removal." >&2
  exit 1
fi

echo "REMOVED_HOST=${HOSTNAME}"
echo "REMOVED_SITE_ROOT=${SITE_ROOT}"
echo "REMOVED_DEPLOY_ARCHIVE=${DEPLOY_ARCHIVE}"
echo "CADDY_BACKUP=${CADDY_BACKUP}"
echo "CADDY_STATUS=$(systemctl is-active caddy)"
