#!/usr/bin/env bash
# Writes frontend/.env.production from deploy.env (server-only, gitignored).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/frontend/.env.production"

if [ -f "$PROJECT_ROOT/deploy.env" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/deploy.env"
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET is missing — set it in deploy.env" >&2
  exit 1
fi

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo "NEXT_PUBLIC_API_URL is missing — set it in deploy.env" >&2
  exit 1
fi

{
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
  if [ -n "${NEXT_PUBLIC_ENABLE_CRAWLER:-}" ]; then
    echo "NEXT_PUBLIC_ENABLE_CRAWLER=${NEXT_PUBLIC_ENABLE_CRAWLER}"
  fi
} > "$ENV_FILE"

echo "Wrote $ENV_FILE"
