import { createGarden } from '../api/createGarden';
import { runTransaction } from 'firebase/firestore';

jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn((_db, _collection, id) => ({ id })), runTransaction: jest.fn(), serverTimestamp: () => 'server-time' }));

it('creates an empty garden and reconciles a retry without replacing its members', async () => {
  let saved: Record<string, unknown> | null = null;
  const set = jest.fn((_ref, data) => { saved = data; });
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => !!saved, data: () => saved }), set } as never));
  await createGarden('request-id', ' Patio ', 'outdoor', { lat: -26, lng: 28 }, 'Johannesburg');
  expect(saved).toMatchObject({ name: 'Patio', plantIds: [], createdBy: 'owner', location: { lat: -26, lng: 28 }, locationLabel: 'Johannesburg' });
  saved = { ...saved!, plantIds: ['new-member'] };
  await createGarden('request-id', 'Patio', 'outdoor', { lat: -26, lng: 28 }, 'Johannesburg');
  expect(set).toHaveBeenCalledTimes(1);
  expect(saved.plantIds).toEqual(['new-member']);
});
it('rejects a retry ID owned by another account', async () => {
  const set = jest.fn();
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => true, data: () => ({ createdBy: 'other' }) }), set } as never));
  await expect(createGarden('foreign', 'Patio', 'outdoor', { lat: -26, lng: 28 }, 'Johannesburg')).rejects.toThrow('unavailable');
  expect(set).not.toHaveBeenCalled();
});

it.each([null, { lat: NaN, lng: 28 }, { lat: -91, lng: 28 }, { lat: 0, lng: 181 }])('rejects an absent or invalid garden location: %j', async location => {
  await expect(createGarden('new', 'Patio', 'outdoor', location as never)).rejects.toThrow('Choose a location');
  expect(runTransaction).not.toHaveBeenCalled();
});
