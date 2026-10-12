import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Import the traced function outside the repository so missing runtime
// dependencies cannot be hidden by the workspace's node_modules.
const directory = mkdtempSync(join(tmpdir(), 'luxury-olivia-function-'));
try {
  cpSync('.vercel/output/functions/_render.func', directory, { recursive: true });
  const entry = pathToFileURL(join(directory, '.vercel/output/server/entry.mjs')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(entry)});`], { cwd: directory, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
  assert.ok(config.routes.some(route => route.src?.includes('/api/olivia/')));
  console.log('Olivia function starts with its packaged dependencies and has an API route.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
