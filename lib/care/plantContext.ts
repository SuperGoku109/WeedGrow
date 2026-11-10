/** Shared profile choices. Unknown never implies exposure or drainage. */
export const POT_MATERIALS = ['unknown', 'plastic', 'terracotta', 'glazed_ceramic', 'fabric', 'wood', 'metal', 'composite', 'other'] as const;
export const POT_TYPES = ['unknown', 'standard', 'grow_bag', 'hanging', 'self_watering', 'window_box', 'raised_planter', 'other'] as const;
export const GROWING_SITES = ['unknown', 'garden', 'balcony', 'patio', 'terrace', 'rooftop', 'courtyard', 'windowsill', 'other'] as const;
export const DRAINAGE_TYPES = ['unknown', 'holes', 'no_holes', 'reservoir_overflow'] as const;
export const FERTILIZER_FORMS = ['unknown', 'liquid', 'granular', 'slow_release', 'other'] as const;
export const contextChoices = { potMaterial: POT_MATERIALS, potType: POT_TYPES, growingSite: GROWING_SITES, potDrainage: DRAINAGE_TYPES, fertilizerForm: FERTILIZER_FORMS };
export function contextLabel(value: string) {
  return ({ unknown: 'Not sure', terracotta: 'Unglazed terracotta / clay', glazed_ceramic: 'Glazed ceramic', fabric: 'Fabric', grow_bag: 'Grow bag', self_watering: 'Self-watering reservoir', holes: 'Drainage holes', no_holes: 'No drainage holes', reservoir_overflow: 'Reservoir with overflow', window_box: 'Window box', raised_planter: 'Raised planter', slow_release: 'Slow-release' } as Record<string, string>)[value] ?? value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}
