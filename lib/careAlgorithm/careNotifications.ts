import { recommendationSignature, type CareRecommendation } from './outdoorIntelligence';
/** Only sent or already acknowledged findings enter delivery state. */
export function planCareNotifications(recommendations: readonly CareRecommendation[], previous: Record<string, string>, now: number, resolvedIds?: readonly string[]) {
  const active = recommendations.filter(r => r.expiresAt > now && r.generatedAt <= now && r.priority !== 'LOW' && r.status === 'active')
    .filter((r, i, all) => all.findIndex(other => other.id === r.id) === i);
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const send = active.filter(r => previous[r.id] !== recommendationSignature(r)).sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id)).slice(0, 3);
  const retained = resolvedIds === undefined ? {} : Object.fromEntries(Object.entries(previous).filter(([id]) => !resolvedIds.includes(id)));
  const signatures = { ...retained, ...Object.fromEntries(active.filter(r => previous[r.id] === recommendationSignature(r) || send.some(s => s.id === r.id)).map(r => [r.id, recommendationSignature(r)])) };
  return { signatures, send };
}
