import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(repoRoot, 'public/ActionMP4');
const outputDir = resolve(repoRoot, 'public/ActionPoster');

mkdirSync(outputDir, { recursive: true });

const files = readdirSync(sourceDir)
  .filter((file) => file.toLowerCase().endsWith('.mp4'))
  .filter((file) => statSync(join(sourceDir, file)).isFile());

let generated = 0;
for (const file of files) {
  const input = join(sourceDir, file);
  const name = basename(file, extname(file));
  const output = join(outputDir, `${name}.jpg`);
  const result = spawnSync('ffmpeg', [
    '-y',
    '-ss', '0',
    '-i', input,
    '-frames:v', '1',
    '-vf', 'scale=320:-2',
    '-q:v', '4',
    output,
  ], { stdio: 'pipe' });

  if (result.status !== 0) {
    const message = result.stderr.toString('utf8').trim();
    console.warn(`Failed to generate poster for ${file}: ${message}`);
    continue;
  }
  generated += 1;
}

console.log(`Generated ${generated}/${files.length} posters in public/ActionPoster`);
