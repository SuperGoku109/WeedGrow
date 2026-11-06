import { finite, type Profile, type Setup, type WeatherSample, type WaterResult } from './types';
import { canonicalEvents, type LiveWaterEvent, type WaterEvent } from './events';
import { advance, decide, initialize, refill, transition, validateState, type BankState } from './waterBank';
import { profileIssues } from './profiles';
import { boundedOccurredIntegral, occurredCoverageIssue, selectSamples, type SourceSelection } from './weather';
import { revisionFingerprint } from './revisions';

export interface WaterTransition {
  atUtc: number; setup: Setup; profile: Profile; mode: 'carry' | 'reinitialize';
  /** Supported scenario lineage, not independent recombination of old/new parameters. */
  scenarioMap?: Readonly<Record<string, string>>;
  et0Source?: SourceSelection; rainSource?: SourceSelection;
  eventsAtBoundary?: 'before';
}
export interface WaterTimelineInput {
  setup: Setup; profile: Profile; anchorUtc: number; anchored: boolean; evaluationUtc: number;
  weather: readonly WeatherSample[]; et0Source: SourceSelection; rainSource: SourceSelection; events: readonly WaterEvent[];
  setupAtAnchor?: Setup; profileAtAnchor?: Profile; transitions?: readonly WaterTransition[];
  savedStates?: readonly BankState[];
  /** Required with saved states. Any corrected/deleted/new pre-anchor event invalidates the checkpoint. */
  anchorEventRevisions?: readonly { id: string; revision: number }[];
}
function sameSetup(a: Setup, b: Setup) { return revisionFingerprint(a) === revisionFingerprint(b); }
function sameProfile(a: Profile, b: Profile) { return revisionFingerprint(a) === revisionFingerprint(b); }
const fail = (reason: string, coverageIssue?: WaterResult['coverageIssue']) => ({ states: [] as BankState[], candidate: 'uncertain' as const, reasonCodes: [reason],
  ...(coverageIssue ? { coverageIssue } : {}) });

/** Event timing bounds use completed forcing-bin edges, not invented occurrence timestamps or uniform showers. */
export function replayTimeline(input: WaterTimelineInput) {
  const { anchorUtc, evaluationUtc: now } = input;
  if (!finite(anchorUtc) || !finite(now) || anchorUtc > now || typeof input.anchored !== 'boolean') return fail('invalid_replay_window');
  if (input.setup.status !== 'active' || input.setup.deleting) return fail('inactive_plant');
  let setup = input.setupAtAnchor ?? input.setup; let profile = input.profileAtAnchor ?? input.profile;
  let et0Source = input.et0Source; let rainSource = input.rainSource;
  const changes = [...(input.transitions ?? [])].sort((a, b) => a.atUtc - b.atUtc);
  if (changes.some((c, i) => !finite(c.atUtc) || c.atUtc <= anchorUtc || c.atUtc > now || i > 0 && c.atUtc === changes[i - 1].atUtc
    || !['carry', 'reinitialize'].includes(c.mode))) return fail('invalid_transition_timeline');
  for (const pair of [{ setup, profile }, ...changes]) {
    const issues = profileIssues(pair.setup, pair.profile); if (issues.length) return fail(issues[0]);
    if (pair.setup.environment !== 'outdoor') return fail('unsupported_environment');
  }
  const final = changes.at(-1);
  if (!sameSetup(final?.setup ?? setup, input.setup) || !sameProfile(final?.profile ?? profile, input.profile)) return fail('missing_dated_setup_transition');
  const canonical = canonicalEvents(input.events, now);
  if (canonical.issues.length) return fail(canonical.issues[0]);
  const events = canonical.events;
  const included = input.anchorEventRevisions;
  if (input.savedStates && !included) return fail('checkpoint_event_provenance_missing');
  if (included) {
    if (new Set(included.map(e => e.id)).size !== included.length
      || included.some(e => !events.some(current => current.id === e.id && current.revision === e.revision && current.endUtc <= anchorUtc))
      || events.some(e => e.endUtc <= anchorUtc && !included.some(previous => previous.id === e.id && previous.revision === e.revision))) return fail('checkpoint_history_changed');
  }
  const relevant = events.filter(e => e.startUtc <= now && e.endUtc >= anchorUtc && !included?.some(previous => previous.id === e.id && previous.revision === e.revision));
  if (relevant.some(e => e.startUtc < anchorUtc)) return fail('event_straddles_anchor');
  if (relevant.some(e => e.endUtc > now)) return fail('event_window_exceeds_evaluation');
  if (changes.some(c => c.eventsAtBoundary !== 'before' && relevant.some(e => e.startUtc === c.atUtc && e.endUtc === c.atUtc))) return fail('event_transition_order_unresolved');
  // Timing across a demand-only change is supported when refill semantics are unchanged.
  // Otherwise a dedicated cross-profile timing model is needed; do not mix retention parameters.
  for (const e of relevant) for (const c of changes.filter(c => e.startUtc < c.atUtc && e.endUtc > c.atUtc)) {
    const before = changes.filter(x => x.atUtc < c.atUtc).at(-1)?.profile ?? profile;
    if (c.mode !== 'carry' || before.scenarios.some(s => {
      const next = c.profile.scenarios.find(n => n.id === c.scenarioMap?.[s.id]);
      return !next || next.retainedFraction !== s.retainedFraction || revisionFingerprint(next.unknownRefillL) !== revisionFingerprint(s.unknownRefillL);
    })) return fail('event_transition_delivery_unresolved');
  }
  let states: BankState[];
  try {
    states = input.savedStates ? input.savedStates.map(s => {
      validateState(s);
      if (s.atUtc !== anchorUtc || s.rootZoneKey !== profile.rootZoneKey || !profile.scenarios.some(p => revisionFingerprint(p) === revisionFingerprint(s.scenario))) throw new Error();
      return { ...s, reserveL: [...s.reserveL] as [number, number] };
    }) : profile.scenarios.map(s => initialize(s, anchorUtc, profile.rootZoneKey, input.anchored));
  } catch { return fail('invalid_saved_state'); }
  if (!states.length || !profile.scenarios.every(p => states.some(s => s.scenario.id === p.id))) return fail('checkpoint_scenario_coverage_missing');
  const reasons = new Set<string>(input.anchored ? [] : ['unanchored_bank_range']);
  const effects = { weatherDemand: false, directRain: false, loggedWatering: relevant.some(e => e.appliedL === null || e.appliedL > 0), uncertainRainReception: false };
  if (setup.soilRain === 'unknown' || setup.soilRain === 'partial') reasons.add('rain_reception_zero_full_bounds');
  const segments = [...changes.map(c => c.atUtc), now]; let start = anchorUtc;
  // Lower trajectory applies each event at its earliest permitted forcing edge; upper at its latest.
  // For a fixed coherent loss/refill profile, delaying a nonnegative refill cannot reduce the final bank.
  const appliedLower = new Set<string>(); const appliedUpper = new Set<string>();
  function apply(eventsAtEdge: LiveWaterEvent[], side: 0 | 1) {
    for (const e of eventsAtEdge) {
      states = states.map(s => {
        const updated = refill({ ...s, reserveL: [s.reserveL[side], s.reserveL[side]] }, e.appliedL, [s.scenario.retainedFraction, s.scenario.retainedFraction]);
        const next = [...s.reserveL] as [number, number]; next[side] = updated.reserveL[side];
        return { ...s, reserveL: next };
      });
      (side === 0 ? appliedLower : appliedUpper).add(e.id);
    }
  }
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const end = segments[segmentIndex];
    const required = [et0Source, ...(setup.soilRain === 'no' ? [] : [rainSource])];
    if (required.some(s => !profile.domain.sourceKeys.includes(`${s.provider}/${s.product}/${s.modelSelection}`))) return fail('unsupported_source_domain');
    const lossRows = selectSamples(input.weather, 'et0_mm', et0Source, setup.locationRevision, now);
    const rainRows = selectSamples(input.weather, 'liquid_rain_mm', rainSource, setup.locationRevision, now);
    if (start < end) {
      const lossPath = boundedOccurredIntegral(lossRows, start, end);
      const rainPath = setup.soilRain === 'no' ? { complete: true, rows: [] as WeatherSample[] } : boundedOccurredIntegral(rainRows, start, end);
      if (!lossPath.complete) return fail('history_gap', occurredCoverageIssue(lossRows, 'et0_mm', start, end));
      if (!rainPath.complete) return fail('history_gap', occurredCoverageIssue(rainRows, 'liquid_rain_mm', start, end));
      const boundaries = [...new Set([start, end, ...lossPath.rows.map(r => r.valid_end_utc), ...rainPath.rows.map(r => r.valid_end_utc)])].filter(t => t >= start && t <= end).sort((a, b) => a - b);
      for (let i = 1; i < boundaries.length; i++) {
        const a = boundaries[i - 1], b = boundaries[i];
        const loss = boundedOccurredIntegral(lossRows, a, b);
        const rain = setup.soilRain === 'no' ? { complete: true, lower: 0, upper: 0, partial: false } : boundedOccurredIntegral(rainRows, a, b);
        if (!loss.complete || !rain.complete) return fail('forcing_subinterval_unavailable');
        if (loss.partial || rain.partial) reasons.add('partial_completed_integral_zero_full_bounds');
        effects.weatherDemand ||= loss.upper > 0 && states.some(s => s.scenario.effectiveLossM2 > 0);
        effects.directRain ||= rain.lower > 0 && setup.soilRain === 'yes' && states.some(s => s.scenario.catchmentM2 * s.scenario.rainDelivery > 0);
        effects.uncertainRainReception ||= rain.upper > 0 && (setup.soilRain === 'partial' || setup.soilRain === 'unknown');
        apply(relevant.filter(e => !appliedUpper.has(e.id) && e.endUtc <= a), 1);
        apply(relevant.filter(e => !appliedLower.has(e.id) && e.startUtc < b), 0);
        states = states.map(s => {
          const lower = advance({ ...s, reserveL: [s.reserveL[0], s.reserveL[0]] }, b, loss.upper, rain.lower, setup.soilRain === 'yes');
          const upper = advance({ ...s, reserveL: [s.reserveL[1], s.reserveL[1]] }, b, loss.lower, rain.upper, setup.soilRain !== 'no');
          return { ...s, atUtc: b, reserveL: [lower.reserveL[0], upper.reserveL[1]] };
        });
        apply(relevant.filter(e => !appliedUpper.has(e.id) && e.endUtc <= b), 1);
        // Exact edge events follow history through the boundary on both trajectories.
        apply(relevant.filter(e => !appliedLower.has(e.id) && e.startUtc === b && e.endUtc === b), 0);
      }
    } else {
      apply(relevant.filter(e => !appliedLower.has(e.id) && e.startUtc === end), 0);
      apply(relevant.filter(e => !appliedUpper.has(e.id) && e.endUtc === end), 1);
    }
    const change = changes[segmentIndex];
    if (change) {
      try {
        if (change.mode === 'reinitialize') states = change.profile.scenarios.map(s => initialize(s, change.atUtc, change.profile.rootZoneKey));
        else {
          if (!change.scenarioMap || new Set(Object.values(change.scenarioMap)).size !== change.profile.scenarios.length) return fail('transition_scenario_mapping_missing');
          states = states.map(s => {
            const target = change.profile.scenarios.find(p => p.id === change.scenarioMap![s.scenario.id]);
            if (!target || target.capacityL !== s.scenario.capacityL || change.profile.rootZoneKey !== s.rootZoneKey
              || setup.plantedIn !== change.setup.plantedIn || setup.potVolumeL !== change.setup.potVolumeL || setup.medium !== change.setup.medium) throw new Error();
            const lower = transition({ ...s, reserveL: [s.reserveL[0], s.reserveL[0]] }, target, change.profile.rootZoneKey, change.atUtc, true);
            const upper = transition({ ...s, reserveL: [s.reserveL[1], s.reserveL[1]] }, target, change.profile.rootZoneKey, change.atUtc, true);
            return { ...lower, reserveL: [lower.reserveL[0], upper.reserveL[1]] };
          });
          if (!change.profile.scenarios.every(p => states.some(s => s.scenario.id === p.id))) return fail('transition_scenario_coverage_missing');
        }
      } catch { return fail('unsupported_state_transition'); }
      if (setup.locationRevision !== change.setup.locationRevision && (!change.et0Source || change.setup.soilRain !== 'no' && !change.rainSource)) return fail('transition_source_selection_required');
      setup = change.setup; profile = change.profile; et0Source = change.et0Source ?? et0Source; rainSource = change.rainSource ?? rainSource;
      reasons.add(change.mode === 'carry' ? 'compatible_transition_carried' : 'physical_transition_reinitialized');
    }
    start = end;
  }
  if (appliedLower.size !== relevant.length || appliedUpper.size !== relevant.length) return fail('event_timing_unresolved');
  if (relevant.some(e => e.startUtc !== e.endUtc || !states.every(s => s.reserveL[0] === s.reserveL[1]))) reasons.add('conservative_event_timing_bounds');
  const candidate = decide(states);
  if (candidate === 'uncertain') reasons.add('scenarios_span_watering_threshold');
  return { states, candidate, reasonCodes: [...reasons], evidence: { historyStartUtc: anchorUtc, historyEndUtc: now,
    scenarios: states.map(s => ({ id: s.scenario.id, reserveL: s.reserveL, actionReserveL: s.scenario.actionReserveL })), effects } };
}
