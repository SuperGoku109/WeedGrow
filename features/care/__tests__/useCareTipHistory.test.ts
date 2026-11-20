import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import type { Plant } from '@/firestoreModels';
import type { CareTipRecord } from '@/lib/care/careTipHistory';
import { saveCareTips } from '@/services/careTipHistory';
import type { GardenCareGroup } from '@/features/home/gardenCare';
import { useCareTipHistory } from '../useCareTipHistory';

jest.mock('@/services/careTipHistory', () => ({ saveCareTips: jest.fn() }));

it('clears a failed capture once the live plant history contains the missing tip', async () => {
  const tip: CareTipRecord = { key: 'wind', day: '2026-11-20', kind: 'weather', title: 'Wind', detail: 'Secure loose supports.', seenAt: 1 };
  const plant = { id: 'p', name: 'Fern' } as Plant & { id: string };
  const groups: GardenCareGroup[] = [{ key: 'wind', title: 'Wind', priority: 1, plants: [], tips: [{ plantId: plant.id, tip }] }];
  let state!: ReturnType<typeof useCareTipHistory>;
  function Probe({ saved }: { saved: boolean }) {
    state = useCareTipHistory('owner', groups, [saved ? { ...plant, careTipHistory: [tip] } : plant], true);
    return null;
  }

  jest.mocked(saveCareTips).mockRejectedValueOnce(new Error('offline'));
  let renderer!: ReturnType<typeof create>;
  await act(async () => { renderer = create(React.createElement(Probe, { saved: false })); });
  expect(state.error).toBe('Could not save recent tips to history.');

  await act(async () => { renderer.update(React.createElement(Probe, { saved: true })); });
  expect(state.error).toBe('');
  expect(saveCareTips).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
});
