import { evaluationValidAt } from '@/lib/careAlgorithm/evaluationValidity';
import type { CareTask } from './careTasks';
import type { Evaluation } from '@/lib/careAlgorithm/types';
/** Calendar reviews, not fertilizer dosing or a prediction of nutrient need. */
export function contextualCareTasks(tasks: readonly CareTask[], evaluations: ReadonlyMap<string, Evaluation>, nowUtc: number): CareTask[] {
  return tasks.map(task => {
    if (task.kind !== 'feeding' || task.mode !== 'smart') return task;
    const evaluation = evaluations.get(task.plantId);
    const outdoor = evaluationValidAt(evaluation, nowUtc) ? evaluation?.outdoor : undefined;
    const nextCheck = outdoor?.nextCheckUtc;
    const waitForCheck = typeof nextCheck === 'number' && nextCheck > nowUtc && nextCheck * 1000 > task.due.getTime();
    // Bound deferral to one day after the calendar review; refreshed checks must not postpone it indefinitely.
    return { ...task, due: waitForCheck ? new Date(Math.min(nextCheck * 1000, task.due.getTime() + 86400000)) : task.due,
      reviewReason: waitForCheck ? 'Review the product label and feeding plan after the planned soil check.' : 'Review your product label, recent feeding and current plant conditions before deciding to fertilize.' };
  });
}
