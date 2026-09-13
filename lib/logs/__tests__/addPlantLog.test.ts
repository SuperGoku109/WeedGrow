import { addDoc, getDocs } from 'firebase/firestore';
import { addPlantLog } from '../addPlantLog';
import { buildManualPlantLog } from '../plantJournal';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'logs-ref'), addDoc: jest.fn(async () => ({})),
  serverTimestamp: jest.fn(() => 'server-time'), query: jest.fn(() => 'query'),
  where: jest.fn(), getDocs: jest.fn(), Timestamp: { fromDate: jest.fn((date: Date) => date) },
}));

describe('journal persistence', () => {
  it('writes a historical feeding entry to the requested local day', async () => {
    await addPlantLog('test-plant', buildManualPlantLog('feeding', 'Nutrients'), '2026-09-10');
    expect(addDoc).toHaveBeenCalledWith('logs-ref', expect.objectContaining({
      type: 'fertilizing', category: 'feeding', timestamp: new Date('2026-09-10T12:00:00'),
    }));
  });
  it('blocks a duplicate watering without writing another entry', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ empty: false });
    await expect(addPlantLog('test-plant', buildManualPlantLog('watering', ''), '2026-09-10')).rejects.toThrow('Watering already logged');
    expect(addDoc).not.toHaveBeenCalled();
  });
  it('propagates a write failure so the composer can keep the draft', async () => {
    (addDoc as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await expect(addPlantLog('test-plant', buildManualPlantLog('pests', 'Spotted insects'))).rejects.toThrow('Offline');
  });
});
