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

// Read metadata only: this command never retrieves the secret payload.
const metadata = run(['functions:secrets:get', 'OPENWEATHERMAP_API_KEY', '--json'], { stdio: 'pipe', encoding: 'utf8' });
if (metadata.status !== 0) {
  let message = '';
  try { message = JSON.parse(metadata.stdout).error || ''; } catch { message = 'Could not read deployment secret metadata.'; }
  if (!/not found|NOT_FOUND|404/i.test(message)) throw new Error(message);
  const envPath = path.join(root, '.env');
  const local = fs.existsSync(envPath) ? require('dotenv').parse(fs.readFileSync(envPath)) : {};
  const key = process.env.OPENWEATHERMAP_API_KEY || local.OPENWEATHERMAP_API_KEY;
  if (typeof key !== 'string' || !key.trim()) throw new Error('OPENWEATHERMAP_API_KEY is missing from the local environment.');
  // Pipe directly to Secret Manager through the official CLI; no key in argv, logs or temporary files.
  const created = run(['functions:secrets:set', 'OPENWEATHERMAP_API_KEY', '--data-file', '-'], { input: key, stdio: ['pipe', 'inherit', 'inherit'] });
  if (created.status !== 0) process.exit(created.status || 1);
}
const result = run(['deploy', '--only', 'functions,firestore:rules,firestore:indexes']);
if (result.error) throw result.error;
process.exit(result.status || 0);
