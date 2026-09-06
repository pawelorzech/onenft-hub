#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun install --frozen-lockfile
bun run typecheck
bun test
build_dir=$(mktemp -d)
trap 'rm -rf "$build_dir"' EXIT
bun build src/server.ts --target=bun --outdir="$build_dir"
bun audit
git diff --check
