#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

echo "Environment variables loaded from $ENV_FILE"

required_vars="APPLEID APPLEIDPASS APPLEIDTEAM P12_BASE64 P12_PASSWORD"
for var_name in $required_vars; do
  if [ -z "${!var_name:-}" ]; then
    echo "Missing required environment variable: $var_name"
    exit 1
  fi
done

# --- temporary keychain ---
KEYCHAIN="ci-signing.keychain"
KEYCHAIN_PWD="$(openssl rand -hex 16)"

# Remove if it exists
if security list-keychains | grep -q "$KEYCHAIN"; then
  echo "Keychain already exists. Removing..."
  security delete-keychain "$KEYCHAIN" || true
fi

security create-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security set-keychain-settings "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security list-keychains -s "$KEYCHAIN" login.keychain

# --- P12 (base64 -> file) ---
printf '%s' "$P12_BASE64" | tr -d '\n' | base64 -d 2>/dev/null > cert.p12 || printf '%s' "$P12_BASE64" | tr -d '\n' | base64 -D > cert.p12
security import cert.p12 -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PWD" "$KEYCHAIN"
security find-identity -v -p codesigning "$KEYCHAIN" || true


APPLEID="$APPLEID" APPLEIDPASS="$APPLEIDPASS" APPLEIDTEAM="$APPLEIDTEAM" APP_PLATFORM="darwin" pnpm --filter @adt/desktop build:mac