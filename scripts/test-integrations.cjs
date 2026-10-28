const { spawnSync } = require('node:child_process');
for (const script of ['scripts/test-functional-workflows.cjs', 'scripts/test-plant-ownership.mjs', 'scripts/test-backend.cjs']) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
