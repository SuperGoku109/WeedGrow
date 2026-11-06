import type { Warning } from './types';

export interface DeliveryPolicy { wateringApproved: boolean; weatherApproved: boolean; consent: boolean; pushEnabled: boolean; trustedSevereSource: boolean }
/** Eligibility only. This pure module has no notification I/O. Gates come from protected policy. */
export function deliveryRoute(warning: Warning, policy: DeliveryPolicy) {
  if (!policy || !(['wateringApproved', 'weatherApproved', 'consent', 'pushEnabled', 'trustedSevereSource'] as const)
    .every(key => typeof policy[key] === 'boolean')) return { card: null, pushEligible: false };
  const { id, state } = warning;
  let card: 'water' | 'unavailable' | 'weather' | 'context' | 'review' | null = null;
  if (id === 'W06') card = state === 'unknown' ? 'unavailable' : policy.wateringApproved && state === 'triggered' ? 'water' : null;
  else if (['W07', 'W13', 'W14'].includes(id) && state === 'review_requested') card = 'review';
  else if (['W08', 'W09', 'W11', 'W12'].includes(id) && state === 'context_only') card = 'context';
  else if (['W01', 'W02', 'W03', 'W04', 'W05'].includes(id) && state === 'triggered' && policy.weatherApproved) card = 'weather';
  return { card, pushEligible: !!card && state === 'triggered' && policy.consent && policy.pushEnabled
    && (card === 'water' ? policy.wateringApproved : card === 'weather' && policy.trustedSevereSource) };
}
