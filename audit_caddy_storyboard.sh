#!/usr/bin/env bash
set -u

echo "--- CADDY VERSION ---"
caddy version 2>/dev/null || true
echo "--- CADDYFILE ---"
sed -E 's/(token|password|secret|api[_-]?key)[[:space:]]+[^[:space:]]+/\1 REDACTED/Ig' /etc/caddy/Caddyfile 2>/dev/null || true
echo "--- CADDY SERVICE ---"
systemctl show caddy -p FragmentPath -p DropInPaths -p User -p Group -p ActiveState -p SubState --no-pager 2>/dev/null || true
echo "--- CADDY DATA ---"
find /var/lib/caddy -maxdepth 4 -type f -printf '%p\n' 2>/dev/null | head -80 || true
echo "--- CADDY VALIDATE ---"
caddy validate --config /etc/caddy/Caddyfile 2>&1 || true
