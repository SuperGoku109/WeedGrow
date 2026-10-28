const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
const root = path.resolve(path.dirname(process.argv[1]), '..');
function run(label, args) {
  process.stdout.write(`\n${label}\n`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('Backend types', ['functions/node_modules/typescript/bin/tsc', '--noEmit', '--project', 'functions/tsconfig.json']);
run('Backend build', ['scripts/build-backend.cjs']);
run('Types', [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
run('Lint and boundaries', [path.join(root, 'node_modules/eslint/bin/eslint.js'), '.', '--ext', '.ts,.tsx', '--max-warnings=0']);
run('Architecture policy', ['scripts/test-architecture.cjs']);
run('Unit and scenario tests', [path.join(root, 'node_modules/jest/bin/jest.js'), '--runInBand', '--silent']);
// Use the existing pinned local CLI; never deploy or connect tests to production.
if (!process.env.npm_execpath) throw new Error('Run this check with npm run verify.');
const npmRoot = spawnSync(process.execPath, [process.env.npm_execpath, 'root', '--global'], { encoding: 'utf8', cwd: root });
if (npmRoot.status !== 0) throw new Error('Could not locate Firebase CLI. Install firebase-tools@15.5.1.');
const cliRoot = path.join(npmRoot.stdout.trim(), 'firebase-tools');
if (!fs.existsSync(path.join(cliRoot, 'package.json')) || JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8')).version !== '15.5.1') throw new Error('Install firebase-tools@15.5.1 to run the local integration checks.');
run('Local Firebase integration and ownership checks', [path.join(cliRoot, 'lib/bin/firebase.js'), 'emulators:exec', '--only', 'auth,firestore', '--project', 'demo-weedgrow', 'node scripts/test-integrations.cjs']);
process.stdout.write('\nPASS: all verification stages completed.\n');
