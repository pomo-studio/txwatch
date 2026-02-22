#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

required_routes=(
  "app/server/api/command/auth/signin.post.ts"
  "app/server/api/command/auth/signup.post.ts"
  "app/server/api/command/auth/confirm.post.ts"
  "app/server/api/command/auth/signout.post.ts"
  "app/server/api/command/auth/me.get.ts"
  "app/server/api/command/tx/create.post.ts"
)

legacy_routes=(
  "app/server/api/auth/signin.post.ts"
  "app/server/api/auth/signup.post.ts"
  "app/server/api/auth/confirm.post.ts"
  "app/server/api/auth/signout.post.ts"
  "app/server/api/auth/me.get.ts"
  "app/server/api/tx.post.ts"
)

for file in "${required_routes[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing required command route: $file"
    exit 1
  fi
done

for file in "${legacy_routes[@]}"; do
  if [[ -f "$file" ]]; then
    echo "legacy route must not exist: $file"
    exit 1
  fi
done

if rg -n "/api/auth/|/api/tx\\b" app/pages app/composables app/server/middleware app/nuxt.config.ts -g "*.ts" -g "*.vue" > /tmp/txwatch-legacy-routes.txt; then
  echo "legacy API path references found in app runtime code:"
  cat /tmp/txwatch-legacy-routes.txt
  exit 1
fi

echo "API boundary check passed."
