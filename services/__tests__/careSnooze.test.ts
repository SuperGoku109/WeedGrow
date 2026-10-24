import { snoozeCare } from '../careSnooze';
import { runTransaction } from 'firebase/firestore';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), query: jest.fn(), where: jest.fn(), onSnapshot: jest.fn(), doc: jest.fn((_db, ...parts) => parts.join('/')), runTransaction: jest.fn() }));
let state: Record<string, any>;
beforeEach(() => {
  state = { owners: ['owner'], status: 'active' };
  jest.mocked(runTransaction).mockImplementation(async (_db, fn) => fn({ get: async () => ({ exists: () => true, data: () => state }), update: (_ref: any, changes: any) => { state = { ...state, ...changes }; } } as never));
});
it('keeps both task snoozes on the plant and clears only the requested task', async () => {
  const until = Date.now() + 3600000;
  await snoozeCare('owner', 'p:watering', until); await snoozeCare('owner', 'p:feeding', until);
  await snoozeCare('owner', 'p:watering', 0);
  expect(state.careSnoozes).toEqual({ feeding: until });
});
it('rejects another account and malformed tasks before saving', async () => {
  await expect(snoozeCare('someone-else', 'p:watering', Date.now())).rejects.toThrow('account');
  await expect(snoozeCare('owner', 'p:unknown', Date.now())).rejects.toThrow('valid');
  expect(runTransaction).not.toHaveBeenCalled();
});
