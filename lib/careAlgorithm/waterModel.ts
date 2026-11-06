import { replayWater, type ReplayInput } from './replay';
import { forecastWater, type ForecastWaterInput } from './forecastWater';
import { resumeWaterCheckpoint, type WaterCheckpoint } from './checkpoint';

export type WaterModelInput = ReplayInput & { checkpoint?: WaterCheckpoint; forecast?: Omit<ForecastWaterInput, 'states' | 'setup' | 'profile' | 'evaluationUtc'> };
/** One shadow-only entry point for history, transitions, saved-state validation and conditional projection. */
export function runWaterModel(input: WaterModelInput) {
  const restored = input.checkpoint ? resumeWaterCheckpoint(input, input.checkpoint) : { input, reused: false, reasonCodes: [] };
  const current = replayWater(restored.input);
  const projection = input.forecast && current.states.length ? forecastWater({ ...input.forecast, states: current.states,
    setup: input.setup, profile: input.profile, evaluationUtc: input.evaluationUtc }) : null;
  return { mode: 'shadow' as const, ...current, reasonCodes: [...restored.reasonCodes, ...current.reasonCodes], projection };
}
