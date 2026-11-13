import React from 'react';
import { TextInput } from 'react-native';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import QuickWateringDialog from '../components/QuickWateringDialog';
import ActionDialog from '@/ui/ActionDialog';
import { saveJournalEntry } from '@/lib/logs/journalRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Plant } from '@/firestoreModels';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, GrowCollapse: ({ open, children }: any) => open ? children : null, GrowRotate: ({ children }: any) => children }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/ui/ActionDialog', () => ({ __esModule: true, default: ({ children }: any) => children(false) }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: () => 'stable-request', saveJournalEntry: jest.fn(), readLastWateringAmount: jest.fn().mockResolvedValue({ hasEntry: false }) }));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(AsyncStorage.getItem).mockResolvedValue(null); });

it('waits for confirmation, preserves unknown amounts, and reuses the request after failure', async () => {
  const onSaved = jest.fn(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(QuickWateringDialog, { plant: { id: 'plant', name: 'Olive' } as Plant & { id: string }, onClose: jest.fn(), onSaved })); });
  expect(saveJournalEntry).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Notes');
  jest.mocked(saveJournalEntry).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ id: 'entry', mutationId: 'stable-request' });
  await expect(renderer.root.findByType(ActionDialog).props.onConfirm()).rejects.toThrow('Connection lost');
  expect(onSaved).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(ActionDialog).props.onConfirm());
  expect(saveJournalEntry).toHaveBeenLastCalledWith('plant', expect.objectContaining({ description: 'Watering recorded.', type: 'watering' }), expect.any(String), undefined, 'stable-request');
  expect(jest.mocked(saveJournalEntry).mock.calls[1][1].waterMl).toBeUndefined();
  expect(onSaved).toHaveBeenCalledWith({ plantId: 'plant', id: 'entry', mutationId: 'stable-request' });
  act(() => renderer.unmount());
});

it('prefills the last successful quick amount and can explicitly leave the amount unknown', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('500');
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(QuickWateringDialog, { plant: { id: 'plant', name: 'Olive' } as Plant & { id: string }, onClose: jest.fn(), onSaved: jest.fn() })); });
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.owner.plant');
  expect(JSON.stringify(renderer.toJSON())).toContain('Using last amount');
  const change = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'Water amount' && node.props.onPress)[0];
  act(() => change.props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe('500');
  const clear = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'Remove water amount' && node.props.onPress)[0];
  act(() => clear.props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe('');
  await act(async () => renderer.root.findByType(ActionDialog).props.onConfirm());
  expect(jest.mocked(saveJournalEntry).mock.calls[0][1].waterMl).toBeUndefined();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.owner.plant');
  act(() => renderer.unmount());
});
it('remembers a chosen amount only after saving and rejects invalid input', async () => {
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(QuickWateringDialog, { plant: { id: 'plant', name: 'Olive' } as Plant & { id: string }, onClose: jest.fn(), onSaved: jest.fn() })); });
  const add = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'Water amount' && node.props.onPress)[0];
  act(() => add.props.onPress());
  act(() => renderer.root.findByType(TextInput).props.onChangeText('-20'));
  await expect(renderer.root.findByType(ActionDialog).props.onConfirm()).rejects.toThrow('between');
  expect(saveJournalEntry).not.toHaveBeenCalled();
  act(() => renderer.root.findByType(TextInput).props.onChangeText('750'));
  await act(async () => renderer.root.findByType(ActionDialog).props.onConfirm());
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('weedgrow.quick-water.v1.owner.plant', '750');
  act(() => renderer.unmount());
});
