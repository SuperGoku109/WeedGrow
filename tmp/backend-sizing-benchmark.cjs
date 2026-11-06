// Local synthetic engineering sizing only. Does not connect to any backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('../functions/node_modules/esbuild');
const root = path.resolve(__dirname, '..');
const build = esbuild.buildSync({ stdin: { contents: "export { evaluateShadow } from './lib/careAlgorithm/evaluate'; export { setup, profile, sample, source } from './lib/careAlgorithm/__tests__/helpers';", resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false });
const bundlePath = path.join(__dirname, 'synthetic-sizing-core.cjs');
const mod = new Module(bundlePath);
mod._compile(build.outputFiles[0].text, bundlePath);
const { evaluateShadow, setup, profile, sample, source } = mod.exports;
const results = [];
for (const [hours, scenarios, repetitions] of [[24, 1, 50], [168, 4, 20], [720, 8, 5]]) {
  const now = hours * 3600;
  const weather = [];
  for (let h = 0; h < hours; h++) for (const [variable, value] of [['et0_mm', .05], ['liquid_rain_mm', h % 72 === 0 ? 2 : 0]]) {
    weather.push(sample(variable, value, { valid_start_utc: h * 3600, valid_end_utc: (h + 1) * 3600, retrieved_at_utc: now, available_at_utc: now }));
  }
  const input = { setup, profile: { ...profile, scenarios: Array.from({ length: scenarios }, (_, i) => ({ ...profile.scenarios[0], id: `synthetic-${i}`, effectiveLossM2: .2 + i * .01 })) },
    anchorUtc: 0, anchored: true, evaluationUtc: now, weather, et0Source: source, rainSource: source, events: [] };
  const initial = evaluateShadow(input);
  assert.equal(initial.states.length, scenarios, JSON.stringify(initial.reasonCodes));
  assert.equal(initial.states[0].atUtc, now);
  const timings = [];
  const cpuStart = process.cpuUsage();
  for (let i = 0; i < repetitions; i++) { const start = performance.now(); evaluateShadow(input); timings.push(performance.now() - start); }
  const cpu = process.cpuUsage(cpuStart);
  timings.sort((a, b) => a - b);
  results.push({ hours, scenarios, repetitions, inputBytes: Buffer.byteLength(JSON.stringify(input)), resultBytes: Buffer.byteLength(JSON.stringify(initial)),
    meanWallMs: timings.reduce((a, b) => a + b, 0) / repetitions, p95WallMs: timings[Math.ceil(repetitions * .95) - 1], meanCpuMs: (cpu.user + cpu.system) / 1000 / repetitions });
}
const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, scope: 'Synthetic water replay only. Excludes production evaluateCare fingerprint/warnings, forecast branches, adapters, database/network/auth, cold starts and hosted runtime. No calibration validation.', results };
fs.writeFileSync(path.join(__dirname, 'backend-sizing-benchmark.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
