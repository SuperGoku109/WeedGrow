// Shared by every path that adds members, including plant creation.
export const MAX_SPACE_PLANTS = 80;
export const MAX_ATOMIC_WATERING_PLANTS = 8;
export function assertSpaceCapacity(ids: readonly string[]) {
  if (new Set(ids).size > MAX_SPACE_PLANTS) throw new Error(`Keep growing spaces to ${MAX_SPACE_PLANTS} plants or fewer.`);
}
