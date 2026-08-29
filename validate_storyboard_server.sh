#!/usr/bin/env bash
set -u

echo "--- DNS ---"
getent ahostsv4 storyboard.hatsuneuua.top | head -3 || true
echo "--- HTTPS UNAUTHENTICATED ---"
curl -sS -D - -o /dev/null --connect-timeout 5 --max-time 20 https://storyboard.hatsuneuua.top/ || true
echo "--- CERTIFICATE ---"
echo | openssl s_client -connect storyboard.hatsuneuua.top:443 -servername storyboard.hatsuneuua.top 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null || true
echo "--- CADDY RECENT LOG ---"
journalctl -u caddy --since '-5 minutes' --no-pager -n 80 2>/dev/null | tail -80 || true
echo "--- CADDY STATUS ---"
systemctl is-active caddy || true
