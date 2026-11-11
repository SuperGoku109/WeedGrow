import type { Plant } from '@/firestoreModels';
export async function syncStageReminders(_uid: string | undefined, _plants: readonly (Plant & { id: string })[], _enabled: boolean, _busyUntil?: number) { return; }
