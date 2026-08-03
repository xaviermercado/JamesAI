const { spawnSync } = require('node:child_process');

const shouldInstall = Boolean(process.env.CI || process.env.RENDER);

if (!shouldInstall) {
  process.exit(0);
}

const result = spawnSync('npm', ['ci'], { stdio: 'inherit', shell: true });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}