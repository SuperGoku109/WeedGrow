import type { Plant } from '@/firestoreModels';
import { isCalendarDay } from '@/lib/dates/plantDay';

const stages = ['germination', 'seedling', 'vegetative', 'flowering', 'harvested', 'drying', 'curing', 'completed'];
const day = (value: unknown): value is string => typeof value === 'string' && isCalendarDay(value);

/** Check the current grow's confirmed dates. Estimates must never prevent a user correcting a date. */
export function assertGrowthDates(previous: Partial<Plant>, updates: Partial<Plant>, today: string) {
  const plant = { ...previous, ...updates };
  const stage = plant.growthStage || 'unknown';
  const rank = stages.indexOf(stage);
  const milestones: [string, string | null | undefined][] = [
    ['Germination', plant.germinationStartedOn],
    ['Emergence', plant.emergedOn],
    ...(rank >= 3 ? [['Flowering', plant.floweringStartedOn] as [string, string | null | undefined]] : []),
    ...(rank >= 3 ? [['Late flowering', plant.lateFloweringStartedOn] as [string, string | null | undefined]] : []),
    ...(rank >= 4 ? [['Harvest', plant.harvestedOn || plant.harvest?.date] as [string, string | null | undefined]] : []),
  ];
  const confirmed = milestones.filter((entry): entry is [string, string] => day(entry[1]));
  for (let i = 1; i < confirmed.length; i++) {
    if (confirmed[i][1] < confirmed[i - 1][1]) throw new Error(`${confirmed[i][0]} cannot be before ${confirmed[i - 1][0].toLowerCase()}. Correct the dates and try again.`);
  }
  const start = plant.stageStartedOn;
  if (!plant.stageStartedOnEstimated && day(start)) {
    if (start > today) throw new Error('The stage start date must be today or earlier.');
    const beforeStage = stage === 'seedling' ? plant.germinationStartedOn
      : stage === 'vegetative' || stage === 'flowering' ? plant.emergedOn || plant.germinationStartedOn
        : stage === 'harvested' ? plant.floweringStartedOn || plant.emergedOn || plant.germinationStartedOn
          : ['drying', 'curing', 'completed'].includes(stage) ? plant.harvestedOn || plant.harvest?.date : null;
    if (day(beforeStage) && start < beforeStage) throw new Error('The stage start date cannot be before the preceding recorded growth date. Correct the dates and try again.');
    const previousRank = stages.indexOf(previous.growthStage || 'unknown');
    if (previousRank >= 0 && rank > previousRank && !previous.stageStartedOnEstimated && day(previous.stageStartedOn) && start < previous.stageStartedOn) {
      throw new Error('The next stage cannot start before the current stage started. Correct the dates and try again.');
    }
  }
  if (plant.ageKnown !== false && !plant.ageEstimated && plant.ageEstimateSource !== 'stage' && day(plant.startedOn)) {
    const afterStart = confirmed.filter(([label]) => label !== 'Germination');
    if ((!plant.stageStartedOnEstimated && stage !== 'germination' && day(start) && start < plant.startedOn) || afterStart.some(([, value]) => value < plant.startedOn!)) {
      throw new Error('A confirmed growth date cannot be before the plant’s start date. Correct the dates and try again.');
    }
  }
}
