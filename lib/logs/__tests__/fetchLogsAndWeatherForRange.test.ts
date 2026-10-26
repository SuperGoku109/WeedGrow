import { getDocs } from 'firebase/firestore';
import { fetchLogsAndWeatherForRange } from '../fetchLogsAndWeatherForRange';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: (_db: unknown, ...parts: string[]) => parts.join('/'), query: (path: string, ...filters: unknown[]) => ({ path, filters }), where: (...args: unknown[]) => args, documentId: () => '__name__', Timestamp: { fromDate: (date: Date) => date }, getDocs: jest.fn() }));
it('loads eight weather days and journal history with just two parallel queries', async () => {
  const timestamp = { toDate: () => new Date('2026-10-20T12:00:00Z'), toMillis: () => Date.parse('2026-10-20T12:00:00Z') };
  jest.mocked(getDocs).mockImplementation(async (q: any) => ({ docs: q.path.endsWith('/logs') ? [{ id: 'watering', data: () => ({ type: 'watering', calendarDay: '2026-10-20', timestamp }) }] : [{ id: '2026-10-20', data: () => ({ date: '2026-10-20', fetchedAt: timestamp, temperature: 20, humidity: 60, rainfall: 0, windSpeed: 1, uvIndex: 2 }) }] }) as never);
  const result = await fetchLogsAndWeatherForRange('p', '2026-10-18', '2026-10-25', 'Africa/Johannesburg');
  expect(getDocs).toHaveBeenCalledTimes(2); expect(Object.keys(result)).toHaveLength(8);
  expect(result['2026-10-20'].logs).toHaveLength(1); expect(result['2026-10-20'].weather?.temperature).toBe(20);
  expect(result['2026-10-21'].weather).toBeNull();
});
it('rejects invalid or excessive ranges before making requests', async () => {
  await expect(fetchLogsAndWeatherForRange('p', '2026-02-31', '2026-03-03')).rejects.toThrow('valid');
  await expect(fetchLogsAndWeatherForRange('p', '2026-01-01', '2026-12-31')).rejects.toThrow('90');
  expect(getDocs).not.toHaveBeenCalled();
});
