import React from 'react';
import { TextInput } from 'react-native';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import QuickWateringDialog from '../components/QuickWateringDialog';
import ActionDialog from '@/ui/ActionDialog';
import { saveJournalEntry } from '@/lib/logs/journalRepository';
import type { Plant } from '@/firestoreModels';
jest.mock('@/ui/ActionDialog', () => ({ __esModule: true, default: ({ children }: any) => children(false) }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: () => 'stable-request', saveJournalEntry: jest.fn() }));

it('waits for confirmation, preserves unknown amounts, and reuses the request after failure', async () => {
  const onSaved = jest.fn(); let renderer: any;
  act(() => { renderer = create(React.createElement(QuickWateringDialog, { plant: { id: 'plant', name: 'Olive' } as Plant & { id: string }, onClose: jest.fn(), onSaved })); });
  expect(saveJournalEntry).not.toHaveBeenCalled();
  act(() => renderer.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'Watering notes').props.onChangeText(' Soil checked '));
  jest.mocked(saveJournalEntry).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ id: 'entry', mutationId: 'stable-request' });
  await expect(renderer.root.findByType(ActionDialog).props.onConfirm()).rejects.toThrow('Connection lost');
  expect(onSaved).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(ActionDialog).props.onConfirm());
  expect(saveJournalEntry).toHaveBeenLastCalledWith('plant', expect.objectContaining({ description: 'Soil checked', type: 'watering' }), expect.any(String), undefined, 'stable-request');
  expect(jest.mocked(saveJournalEntry).mock.calls[1][1].waterMl).toBeUndefined();
  expect(onSaved).toHaveBeenCalledWith({ plantId: 'plant', id: 'entry', mutationId: 'stable-request' });
  act(() => renderer.unmount());
});
