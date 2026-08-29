#!/usr/bin/env bash
set -u

echo "--- SYSTEM ---"
echo "HOSTNAME=$(hostname)"
echo "DATE=$(date -Is)"
grep '^PRETTY_NAME=' /etc/os-release 2>/dev/null || true
echo "--- SERVICES ---"
echo "CADDY=$(systemctl is-active caddy 2>/dev/null || true)"
echo "SUI=$(systemctl is-active s-ui 2>/dev/null || true)"
echo "SSHD=$(systemctl is-active ssh 2>/dev/null || true)"
echo "--- LISTENERS ---"
ss -lntup
echo "--- CADDYFILE ---"
sed -E 's/(token|password|secret|api[_-]?key)[[:space:]]+[^[:space:]]+/\1 REDACTED/Ig' /etc/caddy/Caddyfile 2>/dev/null || true
echo "--- USERS ---"
getent passwd | awk -F: '$3 >= 1000 || $1 == "root" {print $1 ":" $3 ":" $6 ":" $7}'
echo "--- RESOURCES ---"
free -h
df -h /
echo "--- FAILED UNITS ---"
systemctl --failed --no-pager 2>/dev/null || true
