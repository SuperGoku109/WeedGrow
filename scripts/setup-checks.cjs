const { execFileSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
let existing = ''; try { existing = git(['config', '--local', '--get', 'core.hooksPath']); } catch { /* No custom hook path. */ }
if (existing && existing !== '.githooks') throw new Error('A custom Git hook path is already configured. Preserve it and call npm run verify from its pre-push hook.');
const current = git(['rev-parse', '--git-path', 'hooks/pre-push']);
if (!existing && fs.existsSync(current)) throw new Error('An existing pre-push hook was preserved. Add npm run verify to it before enabling this hook path.');
if (process.platform !== 'win32') fs.chmodSync(path.resolve('.githooks/pre-push'), 0o755);
git(['config', '--local', 'core.hooksPath', '.githooks']);
console.log('Enabled the local pre-push verification gate for this repository.');
