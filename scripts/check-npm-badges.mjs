#!/usr/bin/env node
// Fails if README.md shows an npm badge for a package that is not on the npm registry.
// Guard against the auto-package-badges GitHub App re-adding badges for unpublished packages.
import { readFileSync } from 'node:fs';
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const names = new Set();
for (const m of readme.matchAll(/img\.shields\.io\/npm\/[a-z]+\/([^?)\s]+)/g)) names.add(decodeURIComponent(m[1]));
for (const m of readme.matchAll(/npmjs\.com\/package\/([^)\s]+)/g)) names.add(decodeURIComponent(m[1]));
let bad = 0;
for (const name of names) {
  const res = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`);
  if (res.status !== 200) { console.error(`README badge points to npm package "${name}" (registry HTTP ${res.status})`); bad++; }
}
if (bad) process.exit(1);
console.log(`npm badge check OK (${names.size} package(s) referenced)`);
