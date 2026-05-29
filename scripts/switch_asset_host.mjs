import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
const allowedModes = new Set(['local', 'cdn']);

if (!allowedModes.has(mode)) {
  console.error('Usage: node scripts/switch_asset_host.mjs <local|cdn>');
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repoRoot, `public/config/asset-host.${mode}.json`);
const target = resolve(repoRoot, 'public/config/asset-host.json');

copyFileSync(source, target);
console.log(`Switched asset host to ${mode}: public/config/asset-host.json`);
