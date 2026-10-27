import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import ActionDialog from '@/ui/ActionDialog';
import { updateGroup } from '../api/groupApi';
const mockGroup = { id: 'garden', name: 'Patio', environment: 'outdoor', plantIds: ['member'] };
const mockPlants = [
  { id: 'member', name: 'Member', status: 'active', growthStage: 'seedling', environment: 'outdoor', groupId: 'garden' },
  { id: 'eligible', name: 'Available', status: 'active', growthStage: 'seedling', environment: 'outdoor', groupId: 'other' },
  { id: 'indoor', name: 'Indoor plant', status: 'active', growthStage: 'seedling', environment: 'indoor' },
];
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'garden' }), useRouter: () => mockRouter }));
jest.mock('../hooks/useGroupDetail', () => ({ useGroupDetail: () => ({ group: mockGroup, plants: [mockPlants[0]], loading: false, error: '', refreshGroup: jest.fn(), editVisible: false, setEditVisible: jest.fn(), handleDeleteGroup: jest.fn(), confirmDeleteVisible: false, cancelDeleteGroup: jest.fn(), confirmDeleteGroup: jest.fn() }) }));
jest.mock('@/features/plants/hooks/usePlantList', () => ({ usePlantList: () => ({ plants: mockPlants, loading: false, error: '' }) }));
jest.mock('@/hooks/useGardenData', () => ({ useOwnedGroups: () => ({ groups: [mockGroup, { id: 'other', name: 'Balcony', plantIds: ['eligible'] }] }) }));
jest.mock('../api/groupApi', () => ({ updateGroup: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/logs/groupWatering', () => ({ waterGrowingSpace: jest.fn() }));
jest.mock('@/lib/plants/plantImages', () => ({ getRenderablePlantImageUri: () => null }));
jest.mock('@/ui/PlantImage', () => ({ PlantImage: () => null }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-paper', () => ({ Snackbar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
jest.mock('@/ui/useDiscardGuard', () => ({ useDiscardGuard: () => ({ requestClose: (fn: () => void) => fn(), finish: (fn: () => void) => fn(), dialog: null }) }));
jest.mock('../components/EditGroupModal', () => () => null);
jest.mock('../components/ConfirmDeleteModal', () => () => null);
jest.mock('../components/MovePlantDialog', () => () => null);
let renderer: any;
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
beforeEach(() => { jest.clearAllMocks(); act(() => { renderer = create(React.createElement(GroupDetailScreen)); }); });
afterEach(() => act(() => renderer.unmount()));
it('opens member details and creates a new plant in the current garden', () => {
  act(() => button('Open Member').props.onPress()); expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/plant/[id]', params: { id: 'member', fromGroupId: 'garden' } });
  act(() => button('New plant').props.onPress()); expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/add-plant', params: { gardenId: 'garden' } });
});
it('adds eligible plants in one update with a membership baseline', async () => {
  act(() => button('Add existing').props.onPress());
  expect(button('Select Member')).toBeUndefined(); expect(button('Select Indoor plant')).toBeUndefined();
  expect(renderer.root.findAll((node: any) => node.props.children === 'Currently in Balcony').length).toBeGreaterThan(0);
  act(() => button('Select Available').props.onPress());
  await act(async () => { await button('Add 1 plant').props.onPress(); });
  expect(updateGroup).toHaveBeenCalledWith('garden', { plantIds: ['member', 'eligible'] }, mockGroup);
});
it('asks before removal and leaves membership intact on cancel', () => {
  act(() => button('Remove Member from garden').props.onPress());
  expect(renderer.root.findByType(ActionDialog).props.description).toContain('journal and photos');
  expect(updateGroup).not.toHaveBeenCalled();
  act(() => renderer.root.findByType(ActionDialog).props.onClose());
  expect(renderer.root.findAllByType(ActionDialog)).toHaveLength(0); expect(updateGroup).not.toHaveBeenCalled();
});
it('confirms removal through the existing membership service with conflict protection', async () => {
  act(() => button('Remove Member from garden').props.onPress());
  await act(async () => { await renderer.root.findByType(ActionDialog).props.onConfirm(); });
  expect(updateGroup).toHaveBeenCalledWith('garden', { plantIds: [] }, mockGroup);
});
