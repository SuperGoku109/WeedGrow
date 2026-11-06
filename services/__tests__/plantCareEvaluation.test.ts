import { getDoc } from 'firebase/firestore';
import { readPlantCareStatus, readPlantCareEvaluation } from '../plantCareEvaluation';
import { evaluateCare } from '@/lib/careAlgorithm/evaluate';
import { plantSetup } from '@/lib/careAlgorithm/appAdapter';
import { careInputKey } from '@/lib/careAlgorithm/snapshot';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';
import { resetLiveStores } from '@/lib/data/liveStore';
let mockUid = 'demoUser';
jest.mock('../session', () => ({ requireUserId: () => mockUid }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => ({})), getDoc: jest.fn() }));
jest.mock('../firebase', () => ({ db: {} }));
const plant = makePlantSummary({ careEvaluationRevision: 'r1', locationRevision: 1 });
function snapshot() {
  return { schemaVersion: 1, revision: 'r1', inputKey: careInputKey(plant), configurationRevision: 1,
    evaluation: evaluateCare({ setup: plantSetup(plant), evaluationUtc: 7200, nextEvaluationUtc: 8000, profile: null, policyVersion: 'test', warningWindows: [] }) };
}
beforeEach(() => { jest.clearAllMocks(); resetLiveStores(); mockUid = 'demoUser'; });
test('missing backend pointer explains the deployment/publication gap without reading a nonexistent snapshot', async () => {
  const out = await readPlantCareStatus('plant', { ...plant, careEvaluationRevision: undefined }, new Date(7300000));
  expect(out.diagnostic).toMatchObject({ status: 'server_evaluation_missing', source: 'local_fallback', backendRevisionPresent: false });
  expect(getDoc).not.toHaveBeenCalled(); expect(out.evaluation).toBeNull();
});
test('referenced-but-missing snapshot has a distinct status', async () => {
  jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
  expect((await readPlantCareStatus('plant', plant, new Date(7300000))).diagnostic.status).toBe('server_snapshot_missing');
});
test('valid protected uncertainty preserves the actual backend reason codes', async () => {
  const s = snapshot(); jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => s } as any);
  const out = await readPlantCareStatus('plant', plant, new Date(7300000));
  expect(out.diagnostic).toMatchObject({ source: 'backend', status: 'backend_evaluation_available', snapshotEvaluatedUtc: 7200, snapshotExpiresUtc: 8000 });
  expect(out.evaluation?.water.reasonCodes).toContain('profile_unavailable');
  expect(await readPlantCareEvaluation('plant', plant, new Date(7300000))).toEqual(s.evaluation);
});
test('expired server snapshot keeps its original timestamps and expiry cause instead of becoming a profile/history error', async () => {
  jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: snapshot } as any);
  const out = await readPlantCareStatus('plant', plant, new Date(8000000));
  expect(out.evaluation).toBeNull(); expect(out.diagnostic).toMatchObject({ status: 'server_evaluation_expired', snapshotEvaluatedUtc: 7200, snapshotExpiresUtc: 8000 });
});
test.each([
  ['permission-denied', 'server_snapshot_read_permission_denied'], ['unauthenticated', 'server_snapshot_read_permission_denied'],
  ['unavailable', 'server_snapshot_read_unavailable'], ['deadline-exceeded', 'server_snapshot_read_unavailable'], ['unexpected', 'server_snapshot_read_failed'],
])('SDK %s is preserved as %s without exposing raw request data', async (code, status) => {
  jest.mocked(getDoc).mockRejectedValue({ code, message: 'SECRET-RAW-URL-AND-CREDENTIAL' });
  const out = await readPlantCareStatus('plant', plant, new Date(7300000));
  expect(out.diagnostic.status).toBe(status); expect(JSON.stringify(out)).not.toContain('SECRET'); expect(out.evaluation).toBeNull();
});
test('changed setup and wrong snapshot revision are distinguishable', async () => {
  const s = snapshot(); jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => s } as any);
  expect((await readPlantCareStatus('plant', { ...plant, careMedium: 'soil' }, new Date(7300000))).diagnostic.status).toBe('server_snapshot_input_changed');
  expect((await readPlantCareStatus('plant', { ...plant, careEvaluationRevision: 'r2' }, new Date(7300000))).diagnostic.status).toBe('server_snapshot_revision_mismatch');
});

test('concurrent and repeated reads share one request; expiry still advances without refetching', async () => {
  jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: snapshot } as any);
  const results = await Promise.all(Array.from({ length: 10 }, () => readPlantCareStatus('plant', plant, new Date(7300000))));
  expect(results.every(result => result.evaluation !== null)).toBe(true);
  expect(getDoc).toHaveBeenCalledTimes(1);
  expect((await readPlantCareStatus('plant', plant, new Date(8000000))).diagnostic.status).toBe('server_evaluation_expired');
  expect(getDoc).toHaveBeenCalledTimes(1);
});

test('new revisions fetch again; sign-out resets and account switches cannot expose cached care', async () => {
  jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: snapshot } as any);
  await readPlantCareStatus('plant', plant, new Date(7300000));
  await readPlantCareStatus('plant', { ...plant, careEvaluationRevision: 'r2' }, new Date(7300000));
  expect(getDoc).toHaveBeenCalledTimes(2);
  resetLiveStores();
  await readPlantCareStatus('plant', plant, new Date(7300000));
  expect(getDoc).toHaveBeenCalledTimes(3);
  mockUid = 'outsider';
  expect((await readPlantCareStatus('plant', plant, new Date(7300000))).diagnostic.status).toBe('server_snapshot_read_permission_denied');
  expect(getDoc).toHaveBeenCalledTimes(3);
});

test('failed or missing reads remain retryable', async () => {
  jest.mocked(getDoc).mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce({ exists: () => false } as any)
    .mockResolvedValueOnce({ exists: () => true, data: snapshot } as any);
  expect((await readPlantCareStatus('plant', plant, new Date(7300000))).evaluation).toBeNull();
  expect((await readPlantCareStatus('plant', plant, new Date(7300000))).evaluation).toBeNull();
  expect((await readPlantCareStatus('plant', plant, new Date(7300000))).evaluation).not.toBeNull();
  expect(getDoc).toHaveBeenCalledTimes(3);
});
