#!/usr/bin/env bash
# Packs every published package, asserts the tarball contents, then installs
# the tarballs into a scratch consumer project and smoke-tests the imports.
# Usage: ./scripts/pack-test.sh   (from anywhere; builds the workspace first)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Building workspace"
npm run build

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PACKAGES=(core express nestjs cli)

echo "==> Packing"
for pkg in "${PACKAGES[@]}"; do
  (cd "packages/$pkg" && npm pack --json --pack-destination "$WORK" >"$WORK/pack-$pkg.json")
  echo "    packages/$pkg ok"
done

echo "==> Asserting tarball contents"
node - "$WORK" <<'EOF'
const fs = require('fs');
const path = require('path');
const work = process.argv[2];
const pkgs = ['core', 'express', 'nestjs', 'cli'];
let failed = false;
for (const pkg of pkgs) {
  const [info] = JSON.parse(fs.readFileSync(path.join(work, `pack-${pkg}.json`), 'utf8'));
  const files = info.files.map((f) => f.path);
  const bad = files.filter(
    (p) =>
      p.startsWith('src/') ||
      p.includes('__tests__') ||
      /^tsconfig/.test(p) ||
      p.endsWith('.map') ||
      p.endsWith('.tsbuildinfo') ||
      p.endsWith('.spec.ts'),
  );
  const has = (prefix) => files.some((f) => f === prefix || f.startsWith(prefix + '/'));
  const missing = [];
  if (!has('dist')) missing.push('dist/');
  if (pkg === 'express' && !has('ui-dist')) missing.push('ui-dist/');
  if (!files.includes('package.json')) missing.push('package.json');
  if (!files.includes('LICENSE')) missing.push('LICENSE');
  if (bad.length || missing.length) {
    failed = true;
    console.error(`  ${pkg}: unexpected=${JSON.stringify(bad)} missing=${JSON.stringify(missing)}`);
  }
}
if (failed) process.exit(1);
console.log('  contents ok (dist, LICENSE, package.json; no src/tests/tsconfig/maps)');
EOF

echo "==> Installing tarballs into a scratch consumer"
mkdir "$WORK/consumer"
cd "$WORK/consumer"
npm init -y >/dev/null
npm install "$WORK"/*.tgz --no-audit --no-fund --loglevel=error

echo "==> Import smoke test"
node --input-type=module <<'EOF'
import assert from 'node:assert/strict';
import { EventRegistry, lintSpec } from '@socketdocs/core';
import { SocketDocs, mountDocs, createDocsRouter } from '@socketdocs/express';
import { SocketDocsModule, SocketEvent } from '@socketdocs/nestjs';

assert.equal(typeof EventRegistry, 'function', 'core: EventRegistry');
assert.equal(typeof lintSpec, 'function', 'core: lintSpec');
assert.equal(typeof SocketDocs, 'function', 'express: SocketDocs');
assert.equal(typeof mountDocs, 'function', 'express: mountDocs');
assert.equal(typeof createDocsRouter, 'function', 'express: createDocsRouter');
assert.equal(typeof SocketDocsModule, 'function', 'nestjs: SocketDocsModule');
assert.equal(typeof SocketEvent, 'function', 'nestjs: SocketEvent');

// registry round-trip: declare + lint through the published tarballs
const registry = new EventRegistry({ info: { title: 'Pack test', version: '1.0.0' } });
registry.declare('/', 'hello', { summary: 'hi' });
assert.equal(lintSpec(registry.toSpec()).filter((i) => i.type === 'error').length, 0);

console.log('  imports + registry round-trip ok');
EOF

echo "==> CLI bin smoke test"
version="$(./node_modules/.bin/socketdocs --version)"
case "$version" in
  1.0.0-alpha.0) echo "  socketdocs --version -> $version" ;;
  *) echo "  unexpected version: $version" >&2; exit 1 ;;
esac

echo "==> PACK TEST PASSED"
