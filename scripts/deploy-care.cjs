// Explicit production target. Never upgrades billing, deletes functions/indexes, or prints secret values.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(path.dirname(process.argv[1]), '..');
const project = 'weed-grow';
if (!process.env.npm_execpath) throw new Error('Run with npm run deploy:care.');
const env = { ...process.env };
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'USE_FIREBASE_EMULATORS']) delete env[key];
const modules = spawnSync(process.execPath, [process.env.npm_execpath, 'root', '--global'], { cwd: root, env, encoding: 'utf8' });
if (modules.status !== 0) throw new Error('Could not locate the installed Firebase CLI.');
const cli = path.join(modules.stdout.trim(), 'firebase-tools', 'lib', 'bin', 'firebase.js');
if (!fs.existsSync(cli)) throw new Error('Install firebase-tools before deploying.');
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args, '--project', project, '--non-interactive'], { cwd: root, env, stdio: 'inherit', ...options });

// Open-Meteo's public endpoint needs no provider secret or subscription setup.
// Enforce the journal revision contract before a worker can enroll/cache a
// plant. Never deploy these new functions against the older permissive rules.
for (const target of ['firestore:rules,firestore:indexes', 'functions']) {
  const result = run(['deploy', '--only', target]);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
