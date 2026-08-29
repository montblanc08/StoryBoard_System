#!/usr/bin/env bash
set -u

echo "HOSTNAME=$(hostname)"
echo "DATE=$(date -Is)"
echo "OS=$(grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2-)"
echo "NGINX_BIN=$(command -v nginx || true)"
echo "NGINX_ACTIVE=$(systemctl is-active nginx 2>/dev/null || true)"
echo "CERTBOT_BIN=$(command -v certbot || true)"
echo "ACME_BIN=$(command -v acme.sh || true)"
echo "--- LISTENERS ---"
ss -lntup
echo "--- UFW ---"
ufw status numbered || true
echo "--- NGINX SITES ---"
find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f -> %l\n' 2>/dev/null || true
echo "--- CERTIFICATES ---"
certbot certificates 2>/dev/null || true
find /root/.acme.sh -maxdepth 2 -type f \( -name 'fullchain.cer' -o -name '*.conf' \) -printf '%p\n' 2>/dev/null || true
echo "--- WEB ROOTS ---"
find /var/www -mindepth 1 -maxdepth 2 -printf '%y %p\n' 2>/dev/null || true
echo "--- DISK ---"
df -h / /var 2>/dev/null || true
