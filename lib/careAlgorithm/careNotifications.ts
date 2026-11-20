import { recommendationSignature, type CareRecommendation } from './outdoorIntelligence';
/** Only sent or already acknowledged findings enter delivery state. */
export function planCareNotifications(recommendations: readonly CareRecommendation[], previous: Record<string, string>, now: number, resolvedIds?: readonly string[]) {
  const seen = new Set<string>();
  const changed: { recommendation: CareRecommendation; signature: string }[] = [];
  const resolved = new Set(resolvedIds);
  const retained = resolvedIds === undefined ? [] : Object.entries(previous).filter(([id]) => !resolved.has(id));
  const signatures = new Map(retained);
  for (const recommendation of recommendations) {
    const { id, expiresAt, generatedAt, priority, status } = recommendation;
    if (!(expiresAt > now && generatedAt <= now) || priority === 'LOW' || status !== 'active' || seen.has(id)) continue;
    seen.add(id);
    const signature = recommendationSignature(recommendation);
    if (previous[id] === signature) signatures.set(id, signature);
    else changed.push({ recommendation, signature });
  }
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const selected = changed.sort(({ recommendation: a }, { recommendation: b }) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id)).slice(0, 3);
  for (const { recommendation, signature } of selected) signatures.set(recommendation.id, signature);
  return { signatures: Object.fromEntries(signatures), send: selected.map(entry => entry.recommendation) };
}
