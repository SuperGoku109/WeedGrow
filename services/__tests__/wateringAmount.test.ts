import AsyncStorage from '@react-native-async-storage/async-storage';
import { readLastWateringAmount } from '@/lib/logs/journalRepository';
import { readRememberedWateringAmount, rememberWateringAmount } from '../wateringAmount';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logs/journalRepository', () => ({ readLastWateringAmount: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(AsyncStorage.getItem).mockResolvedValue('250'); });
it('uses the latest journal amount ahead of an older device default', async () => {
  jest.mocked(readLastWateringAmount).mockResolvedValue({ hasEntry: true, amount: 500 });
  expect(await readRememberedWateringAmount('owner', 'plant')).toBe('500');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.owner.plant', '500');
});
it('keeps unknown amounts unknown instead of reusing a stale amount', async () => {
  jest.mocked(readLastWateringAmount).mockResolvedValue({ hasEntry: true });
  expect(await readRememberedWateringAmount('owner', 'plant')).toBe('');
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.owner.plant');
});
it('uses the device fallback offline and isolates plants and accounts', async () => {
  jest.mocked(readLastWateringAmount).mockRejectedValue(new Error('Offline'));
  expect(await readRememberedWateringAmount('owner', 'plant')).toBe('250');
  await rememberWateringAmount('other', 'another', 750);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.other.another', '750');
});
