import { deleteCollectionInBatches } from '../deleteCollectionInBatches';
import { getDocs, writeBatch } from 'firebase/firestore';
jest.mock('firebase/firestore', () => ({ collection: jest.fn((_db, path) => path), query: jest.fn((_ref, pageSize) => pageSize), limit: jest.fn(size => size), getDocs: jest.fn(), writeBatch: jest.fn() }));
it('bounds each read and resumes safely after a later batch fails', async () => {
  let records = Array.from({ length: 121 }, (_, id) => id);
  const sizes: number[] = []; let commits = 0; let fail = true;
  jest.mocked(getDocs).mockImplementation(async (pageSize: any) => {
    sizes.push(pageSize);
    const docs = records.slice(0, pageSize).map(id => ({ ref: id }));
    return { docs, empty: !docs.length } as any;
  });
  jest.mocked(writeBatch).mockImplementation(() => {
    const staged: number[] = [];
    return { delete: (id: number) => staged.push(id), commit: async () => {
      commits++;
      if (commits === 2 && fail) throw new Error('Connection lost');
      records = records.filter(id => !staged.includes(id));
    } } as any;
  });
  await expect(deleteCollectionInBatches({} as any, 'plants/p/logs')).rejects.toThrow('Connection lost');
  expect(records).toHaveLength(71);
  fail = false;
  await deleteCollectionInBatches({} as any, 'plants/p/logs');
  expect(records).toEqual([]); expect(sizes.every(size => size === 50)).toBe(true);
});
it('rejects invalid batch limits before accessing the database', async () => {
  await expect(deleteCollectionInBatches({} as any, 'plants/p/logs', 0)).rejects.toThrow('batch size');
  expect(getDocs).not.toHaveBeenCalled();
});
