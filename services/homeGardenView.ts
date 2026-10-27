export interface GardenListView { query: string; status: string | null; offset: number }
const views = new Map<string, GardenListView>();
const key = (uid: string | undefined, gardenId: string) => JSON.stringify([uid || 'device', gardenId]);
export function readGardenListView(uid: string | undefined, gardenId: string): GardenListView {
  return views.get(key(uid, gardenId)) || { query: '', status: 'active', offset: 0 };
}
export function saveGardenListView(uid: string | undefined, gardenId: string, view: GardenListView) {
  const id = key(uid, gardenId);
  views.delete(id); views.set(id, { ...view, offset: Math.max(0, view.offset) });
  if (views.size > 100) views.delete(views.keys().next().value!);
}
export function saveGardenScrollOffset(uid: string | undefined, gardenId: string, offset: number) {
  // A delayed native scroll event must not restore an old query/status closure.
  saveGardenListView(uid, gardenId, { ...readGardenListView(uid, gardenId), offset });
}
