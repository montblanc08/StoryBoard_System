#!/usr/bin/env bash
set -u

echo "--- SITE ROOT ---"
if [ -d /var/www/storyboard ]; then
  du -sh /var/www/storyboard
  find /var/www/storyboard -maxdepth 2 -type f | wc -l
else
  echo "missing"
fi
echo "--- DEPLOY ARCHIVE ---"
find /root -maxdepth 1 -type f -name 'storyboard-deploy-*.tar.gz' -printf '%p %s bytes\n' 2>/dev/null || true
echo "--- CADDY HOST BLOCK ---"
grep -n -A25 -B2 '^storyboard\.hatsuneuua\.top' /etc/caddy/Caddyfile 2>/dev/null || true
echo "--- CADDY STATUS ---"
systemctl is-active caddy || true
