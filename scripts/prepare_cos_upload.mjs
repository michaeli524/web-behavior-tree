import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const outputDir = resolve(repoRoot, 'deploy/cos-cn');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function removeMacMetadata(dir) {
  rmSync(resolve(dir, '.DS_Store'), { force: true });

  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      removeMacMetadata(fullPath);
    }
  }
}

function removeLocalMedia(dir) {
  rmSync(resolve(dir, 'ActionMP4'), { recursive: true, force: true });
  rmSync(resolve(dir, 'ActionsGIF'), { recursive: true, force: true });
}

try {
  run('npm', ['run', 'generate:posters']);
  run('npm', ['run', 'build:showcase:cn']);

  if (!existsSync(distDir)) {
    throw new Error('dist directory was not generated.');
  }

  rmSync(outputDir, { recursive: true, force: true });
  cpSync(distDir, outputDir, { recursive: true });
  removeLocalMedia(outputDir);
  removeMacMetadata(outputDir);

  console.log(`COS upload package ready: ${outputDir}`);
} finally {
  run('npm', ['run', 'assets:local']);
}
