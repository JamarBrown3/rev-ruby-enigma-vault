#!/bin/bash
# Quick Terminal login test (added 2026-10-31). Asks for your email, password
# (hidden) and 6-digit code, then logs in with the CSRF token handled for you.
# Nothing is saved: the cookie file is deleted at the end.
# Run from server/ while "npm run dev" is running:  bash scripts/try-login.sh
BASE="${BASE:-http://localhost:3002}"
read -p "Email: " EMAIL
read -s -p "Password: " PW; echo
read -p "6-digit code (press Enter if not admin): " CODE
JAR=$(mktemp)
TOKEN=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([a-f0-9]+)".*/\1/')
BODY=$(EMAIL="$EMAIL" PW="$PW" CODE="$CODE" node -e 'const b={email:process.env.EMAIL,password:process.env.PW};if(process.env.CODE)b.code=process.env.CODE;console.log(JSON.stringify(b))')
echo "--- login"
curl -s -b "$JAR" -c "$JAR" -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" -d "$BODY" -w "\nstatus %{http_code}\n" "$BASE/api/auth/login"
echo "--- who am I"
curl -s -b "$JAR" -w "\nstatus %{http_code}\n" "$BASE/api/auth/me"
rm -f "$JAR"
