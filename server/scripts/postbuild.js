const { spawnSync } = require('node:child_process');

if (!process.env.RENDER) {
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'db:migrate'], { stdio: 'inherit', shell: true });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}