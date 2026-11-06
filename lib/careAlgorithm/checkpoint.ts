import { ENGINE_VERSION, finite, type Profile, type Setup } from './types';
import { canonicalEvents } from './events';
import { validateState, type BankState } from './waterBank';
import type { ReplayInput } from './replay';
import { revisionFingerprint } from './revisions';
import { selectSamples, type SourceSelection } from './weather';

export interface WaterCheckpoint {
  schemaVersion: 1; engineVersion: string; atUtc: number; originUtc: number;
  originFingerprint: string; historyFingerprint: string; setup: Setup; profile: Profile;
  states: BankState[]; eventRevisions: { id: string; revision: number }[];
}
function originKey(input: ReplayInput) {
  return revisionFingerprint({ at: input.anchorUtc, anchored: input.anchored, setup: input.setupAtAnchor ?? input.setup,
    profile: input.profileAtAnchor ?? input.profile, savedStates: input.savedStates ?? null, included: input.anchorEventRevisions ?? null });
}
/** Compare current authoritative past forcing, not new forecast data or metadata-only refetch times. */
function historyKey(input: ReplayInput, end: number) {
  const segments = [...(input.transitions ?? [])].filter(t => t.atUtc <= end).sort((a, b) => a.atUtc - b.atUtc);
  let setup = input.setupAtAnchor ?? input.setup; let et0 = input.et0Source; let rain = input.rainSource; let start = input.anchorUtc;
  const dependencies: unknown[] = [];
  const selected = (source: SourceSelection, variable: 'et0_mm' | 'liquid_rain_mm', stop: number) => selectSamples(input.weather, variable, source, setup.locationRevision, input.evaluationUtc)
    .filter(s => s.kind === 'occurred_estimate' && s.valid_end_utc > start && s.valid_start_utc < stop)
    .map(s => [s.provider, s.product, s.model_selection, s.source_revision, s.location_revision, s.variable, s.valid_start_utc, s.valid_end_utc, s.time_support, s.unit, s.quality, s.value])
    .sort((a, b) => revisionFingerprint(a).localeCompare(revisionFingerprint(b)));
  for (const change of [...segments, null]) {
    const stop = change?.atUtc ?? end;
    if (start < stop) dependencies.push({ start, stop, setup, et0: selected(et0, 'et0_mm', stop), rain: setup.soilRain === 'no' ? [] : selected(rain, 'liquid_rain_mm', stop) });
    if (change) { dependencies.push(change); setup = change.setup; et0 = change.et0Source ?? et0; rain = change.rainSource ?? rain; }
    start = stop;
  }
  return revisionFingerprint(dependencies);
}
export function makeWaterCheckpoint(input: ReplayInput, states: readonly BankState[]): WaterCheckpoint {
  if (!states.length) throw new Error('checkpoint_state_unavailable');
  for (const state of states) {
    validateState(state);
    if (state.atUtc !== input.evaluationUtc || state.rootZoneKey !== input.profile.rootZoneKey
      || !input.profile.scenarios.some(s => revisionFingerprint(s) === revisionFingerprint(state.scenario))) throw new Error('checkpoint_state_mismatch');
  }
  const current = canonicalEvents(input.events, input.evaluationUtc);
  if (current.issues.length) throw new Error('checkpoint_history_conflict');
  return { schemaVersion: 1, engineVersion: ENGINE_VERSION, atUtc: input.evaluationUtc, originUtc: input.anchorUtc,
    originFingerprint: originKey(input), historyFingerprint: historyKey(input, input.evaluationUtc),
    setup: input.setup, profile: input.profile, states: states.map(s => ({ ...s, reserveL: [...s.reserveL] as [number, number] })),
    eventRevisions: current.events.filter(e => e.endUtc <= input.evaluationUtc).map(e => ({ id: e.id, revision: e.revision })) };
}
export function resumeWaterCheckpoint(input: ReplayInput, checkpoint: WaterCheckpoint): { input: ReplayInput; reused: boolean; reasonCodes: string[] } {
  const rejected = (reason: string) => ({ input, reused: false, reasonCodes: [reason] });
  if (!checkpoint || checkpoint.schemaVersion !== 1 || checkpoint.engineVersion !== ENGINE_VERSION || !finite(checkpoint.atUtc) || checkpoint.originUtc !== input.anchorUtc
    || checkpoint.atUtc < input.anchorUtc || checkpoint.atUtc > input.evaluationUtc || checkpoint.originFingerprint !== originKey(input)) return rejected('checkpoint_origin_changed');
  if (checkpoint.historyFingerprint !== historyKey(input, checkpoint.atUtc)) return rejected('checkpoint_forcing_changed');
  const past = canonicalEvents(input.events, input.evaluationUtc);
  const revisions = past.events.filter(e => e.endUtc <= checkpoint.atUtc).map(e => ({ id: e.id, revision: e.revision }));
  if (past.issues.length || past.events.some(e => e.startUtc < checkpoint.atUtc && e.endUtc > checkpoint.atUtc)
    || revisionFingerprint(revisions) !== revisionFingerprint(checkpoint.eventRevisions)) return rejected('checkpoint_events_changed');
  const change = [...(input.transitions ?? [])].filter(t => t.atUtc <= checkpoint.atUtc).sort((a, b) => a.atUtc - b.atUtc).at(-1);
  const profile = change?.profile ?? input.profileAtAnchor ?? input.profile;
  const setup = change?.setup ?? input.setupAtAnchor ?? input.setup;
  if (revisionFingerprint(profile) !== revisionFingerprint(checkpoint.profile) || revisionFingerprint(setup) !== revisionFingerprint(checkpoint.setup)) return rejected('checkpoint_profile_or_setup_changed');
  try {
    if (!Array.isArray(checkpoint.states) || checkpoint.states.length !== profile.scenarios.length
      || new Set(checkpoint.states.map(s => s.scenario.id)).size !== profile.scenarios.length) return rejected('checkpoint_state_invalid');
    checkpoint.states.forEach(s => {
      validateState(s);
      if (s.atUtc !== checkpoint.atUtc || s.rootZoneKey !== profile.rootZoneKey
        || !profile.scenarios.some(p => revisionFingerprint(p) === revisionFingerprint(s.scenario))) throw new Error('checkpoint_state_invalid');
    });
  } catch { return rejected('checkpoint_state_invalid'); }
  const source = [...(input.transitions ?? [])].filter(t => t.atUtc <= checkpoint.atUtc).sort((a, b) => a.atUtc - b.atUtc)
    .reduce((current, t) => ({ et0: t.et0Source ?? current.et0, rain: t.rainSource ?? current.rain }), { et0: input.et0Source, rain: input.rainSource });
  return { reused: true, reasonCodes: ['checkpoint_reused'], input: { ...input, anchorUtc: checkpoint.atUtc, anchored: true,
    setupAtAnchor: setup, profileAtAnchor: profile, savedStates: checkpoint.states, anchorEventRevisions: checkpoint.eventRevisions,
    et0Source: source.et0, rainSource: source.rain,
    transitions: input.transitions?.filter(t => t.atUtc > checkpoint.atUtc) } };
}
