import type { Plant } from '@/firestoreModels';

export type CareSummarySource = Pick<Plant, 'careSummary' | 'careRevision'>;

/** A summary is usable only for the journal revision it was built from. */
export function currentCareSummary({ careSummary, careRevision }: CareSummarySource) {
  return careSummary?.version === 1 && careSummary.revision === (careRevision ?? 0) ? careSummary : null;
}
