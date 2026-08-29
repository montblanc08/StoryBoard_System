#!/usr/bin/env bash
set -u

echo "--- SYSTEM ---"
hostnamectl 2>/dev/null | head -12
echo "DATE=$(date -Is)"
echo "PYTHON=$(command -v python3 || true)"
echo "DOCKER=$(command -v docker || true)"
echo "PODMAN=$(command -v podman || true)"
echo "SSH=$(command -v ssh || true)"
echo "SYSTEMD_RUN=$(command -v systemd-run || true)"
echo "--- POOLS ---"
zpool status -x 2>/dev/null || true
zfs list -H -o name,used,avail,mountpoint -d 2 Media2 2>/dev/null || true
echo "--- MEDIA2 ROOT ---"
find /mnt/Media2 -mindepth 1 -maxdepth 1 -printf '%y %f\n' 2>/dev/null | sort || true
echo "--- MIGRATION SERVICES ---"
systemctl is-active codex-media2-migration.service 2>/dev/null || true
systemctl is-active codex-media2-monitor.service 2>/dev/null || true
test -f /mnt/Media2/Temp/migration-status.json && sed -n '1p' /mnt/Media2/Temp/migration-status.json || true
echo "--- LISTENERS ---"
ss -lntup
echo "--- CONTAINERS ---"
docker ps --format '{{.ID}} {{.Names}} {{.Ports}} {{.Status}}' 2>/dev/null || true
echo "--- RESOURCES ---"
free -h
df -h / /mnt/Media2 2>/dev/null || true
echo "--- CONNECTIVITY TO VPS ---"
timeout 5 bash -c '</dev/tcp/23.226.133.16/22' && echo 'VPS_SSH_REACHABLE=yes' || echo 'VPS_SSH_REACHABLE=no'
echo "--- FAILED UNITS ---"
systemctl --failed --no-pager 2>/dev/null || true
