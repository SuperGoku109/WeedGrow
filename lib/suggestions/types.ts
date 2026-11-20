import type { WateringInsight } from '@/lib/suggestions/wateringSuggestions';
import type { CareTipRecord } from '@/firestoreModels';

export type SuggestionKind = CareTipRecord['kind'];
export type SuggestionSeverity = 'info' | 'watch' | 'warn' | 'critical';
export type SuggestionConfidence = 'low' | 'medium' | 'high';

export interface SuggestionCard {
  id: string;
  kind: SuggestionKind;
  active: boolean;
  severity: SuggestionSeverity;
  title: string;
  summary: string;
  reasons: string[];
  metrics: Record<string, string | number | boolean | null>;
  confidence: SuggestionConfidence;
  algorithmVersion: string;
  reviewSignature?: string;
  diagnostics?: import('@/lib/careAlgorithm/careDiagnostics').DiagnosticEntry[];
  evidence?: Record<string, unknown>;
}

export interface SuggestionAlgorithmContext {
  insight: WateringInsight;
  now: Date;
}
