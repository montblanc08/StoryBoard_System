#!/usr/bin/env bash
set -u

echo "SITE_ROOT_EXISTS=$([ -e /var/www/storyboard ] && echo yes || echo no)"
echo "DEPLOY_ARCHIVE_COUNT=$(find /root -maxdepth 1 -type f -name 'storyboard-deploy-*.tar.gz' | wc -l | tr -d ' ')"
echo "CADDY_HOST_MATCHES=$(grep -Fc 'storyboard.hatsuneuua.top' /etc/caddy/Caddyfile 2>/dev/null || true)"
echo "CADDY_STATUS=$(systemctl is-active caddy 2>/dev/null || true)"
echo "SUI_STATUS=$(systemctl is-active sui 2>/dev/null || true)"
echo "SANJOSE_HTTPS_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 20 https://sanjose.hatsuneuua.top/ || true)"
echo "ACTIVE_EXPECTED_PORTS=$(ss -lntuH | awk '$5 ~ /:(22|80|443|2095|2096|8443|38526|39261|49385)$/ {print $5}' | sort -u | tr '\n' ' ')"
