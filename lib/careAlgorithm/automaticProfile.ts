import type { Plant } from '@/firestoreModels';
import type { LocalCareSettings } from './localCare';
import { plantSetup } from './appAdapter';
import { parseVolumeL } from './profiles';
import { plantDay, addDays, zonedTime } from '@/lib/dates/plantDay';
import type { Profile, Scenario } from './types';

/** Engineering priors for an uncalibrated pot model, not measured substrate properties
 * or validated hops coefficients. Unknown facts widen the scenario family. */
export function automaticCareProfile(plant: Plant, base: LocalCareSettings, nowUtc: number) {
  const setup = plantSetup(plant); const volume = parseVolumeL(plant.potSize);
  const reasons: string[] = [];
  if (plant.plantedIn !== 'pot') reasons.push('automatic_root_zone_unknown');
  if (plant.plantedIn === 'pot' && (volume === null || volume < .05 || volume > 1000)) reasons.push('automatic_pot_volume_required');
  const litres = volume ?? 10; // Placeholder never produces a decision when volume is unsupported.
  const fractions: Record<string, readonly [number, number]> = { soil: [.10, .24], soilless_mix: [.15, .35], coco: [.18, .38] };
  const available = fractions[plant.careMedium ?? ''] ?? [.08, .38];
  const stages: Record<string, readonly [number, number]> = { germination: [.15, .35], clone: [.2, .5], seedling: [.25, .6], vegetative: [.75, 1.25], flowering: [.9, 1.5] };
  const stage = stages[plant.growthStage] ?? [.15, 1.5];
  const sun = (plant.sunlightExposure ?? '').trim().toLowerCase();
  const exposure: readonly [number, number] = sun === 'full sun' ? [.85, 1] : sun === 'partial sun' ? [.55, .85] : sun === 'mostly shade' ? [.3, .6] : [.3, 1];
  // Cylinder with height equal to diameter gives an approximate pot mouth area.
  // Shape/canopy uncertainty is represented by the scenario ranges below.
  const diameter = Math.cbrt(4 * litres / 1000 / Math.PI);
  const mouth = Math.PI * diameter * diameter / 4;
  const demand = [mouth * 3.5 * stage[0] * exposure[0], mouth * 3.5 * stage[1] * exposure[1]];
  const capacity = available.map(f => f * litres);
  const scenarios: Scenario[] = [];
  for (const cap of capacity) for (const loss of demand) for (const catchment of [mouth * .7, mouth * 1.3]) for (const retention of [.6, .9]) for (const threshold of [.35, .55]) {
    scenarios.push({ id: `auto-${scenarios.length}`, capacityL: cap, actionReserveL: cap * threshold, initialReserveL: [0, cap],
      effectiveLossM2: loss, catchmentM2: catchment, rainDelivery: 1, retainedFraction: retention, unknownRefillL: [0, cap], order: 'inputs_first' });
  }
  const profile: Profile = { id: 'automatic-pot-estimate', version: 'automatic-pot-v1', criterionId: 'experimental-estimate-only', validationEvidenceId: 'NOT-VALIDATED',
    stateAnchorBasis: 'unknown-starting-reserve-range', rootZoneKey: 'automatic-current-pot', transitionPolicy: 'current-setup-assumption',
    domain: { environment: setup.environment, plantedIn: setup.plantedIn ?? 'unknown', stages: [setup.stage], suns: [setup.sun], mediums: [setup.medium],
      potVolumeL: [litres, litres], sourceKeys: ['Local test/assumed-inputs/constant-rate-v1'] }, scenarios };
  const oldest = zonedTime(addDays(plantDay(new Date(nowUtc * 1000), plant.locationTimeZone), -7), '00:00', plant.locationTimeZone).getTime() / 1000;
  let moved = -Infinity;
  try {
    const stamp = plant.locationChangedAt as unknown;
    if (stamp && typeof stamp === 'object' && 'seconds' in stamp && typeof stamp.seconds === 'number') moved = stamp.seconds;
    else if (plant.locationChangedAt) moved = plant.locationChangedAt.toDate().getTime() / 1000;
  } catch { /* Unknown move time cannot provide an anchor. */ }
  const anchorUtc = Number.isFinite(moved) && moved <= nowUtc ? Math.max(oldest, moved) : oldest;
  const nominalCapacity = (capacity[0] + capacity[1]) / 2;
  const settings: LocalCareSettings = { ...base, profileMode: 'automatic', enabled: true, weatherMode: 'open-meteo', includeJournal: true, extraWaterL: 0, anchorUtc,
    capacityL: nominalCapacity, thresholdL: nominalCapacity * .45, initialReserveL: 0,
    effectiveLossM2: (demand[0] + demand[1]) / 2, catchmentM2: mouth, retainedFraction: .75 };
  return { settings, profile, reasonCodes: reasons, basis: [plant.potSize || 'Pot size unknown', plant.growthStage,
    plant.careMedium || 'Medium unknown (wider estimate)', plant.sunlightExposure || 'Sunlight unknown (wider estimate)'] };
}
