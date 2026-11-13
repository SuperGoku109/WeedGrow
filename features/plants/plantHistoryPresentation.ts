import type { Plant, PlantLog } from '@/firestoreModels';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { measurementFields, measurementKeys } from '@/lib/logs/logMeasurements';
import { journalCategory } from '@/lib/logs/plantJournal';
import { journalEntryDay, journalEntryTime, journalKind } from './journalPresentation';
import type { PlantTheme } from './components/plantDetailTheme';
import { phaseWindow } from '@/lib/plants/growthPhase';

export function historyEvent(log: PlantLog, t: PlantTheme) {
  const category = journalCategory(log), kind = journalKind(log);
  if (log.description?.startsWith('Plant added to garden.')) return { title: 'Plant added', icon: 'sprout-outline' as const, color: t.accent };
  if (log.type === 'note' && log.wateringRepeatChange) return { title: 'Watering schedule changed', icon: 'calendar-sync-outline' as const, color: t.water };
  if (log.movement) return { title: 'Location changed', icon: 'map-marker-path' as const, color: t.water };
  if (log.historyEvent === 'setup') return { title: 'Plant details updated', icon: 'pencil-outline' as const, color: t.muted };
  if (log.historyEvent === 'status') return { title: log.toStatus === 'dead' ? 'Plant marked as dead' : log.toStatus === 'active' ? 'Plant restored' : 'Plant archived', icon: log.toStatus === 'dead' ? 'leaf-off' as const : log.toStatus === 'active' ? 'restore' as const : 'archive-outline' as const, color: log.toStatus === 'dead' ? t.danger : t.warm };
  if (log.stageReview) return { title: log.stageReview.action === 'early_signs' ? 'Early flowering signs recorded' : 'Growth phase reviewed', icon: 'sprout-outline' as const, color: t.accent };
  if (category === 'stage_change') return { title: (log.fromPhase || log.fromStage) === (log.toPhase || log.toStage) ? 'Growth phase reviewed' : 'Growth phase changed', icon: kind.icon, color: t.accent };
  const titles: Partial<Record<typeof category, string>> = { watering: 'Watering logged', feeding: 'Feeding logged', photo: 'Photo added', harvest: 'Harvest recorded', measurements: 'Measurements recorded', repotting: 'Repotting logged', flushing: 'Flushing logged', notes: 'Note added', pests: 'Pests recorded', training: 'Training logged', health: 'Health check logged' };
  return { title: titles[category] || kind.label, icon: kind.icon, color: ['watering', 'flushing', 'measurements'].includes(category) ? t.water : ['pests', 'harvest', 'training'].includes(category) ? t.warm : category === 'notes' ? t.muted : t.accent };
}
export function historyDetails(log: PlantLog) {
  const parts: string[] = [];
  if (log.movement) parts.push(`${log.movement.fromLabel || 'Previous location'} → ${log.movement.toLabel || 'New location'}`);
  else if (log.type === 'stage_change' && log.toStage) {
    const from = log.fromPhase || log.fromStage, to = log.toPhase || log.toStage;
    parts.push(from === to ? phaseWindow(to)?.label || to : `${phaseWindow(from || '')?.label || from || 'Not recorded'} → ${phaseWindow(to)?.label || to}`);
  }
  else if (log.type === 'harvest' && log.harvest) {
    if (log.harvest.weightGrams != null) parts.push(`${log.harvest.weightGrams} g harvested`);
    if (log.harvest.notes) parts.push(log.harvest.notes);
  }
  else if (log.description && !['Watering recorded.', 'Measurements recorded.', 'Health measurements recorded.', 'Progress photo added.', 'First progress photo.', 'Plant added to garden.'].includes(log.description)) parts.push(log.description.replace(/^Plant added to garden\.\s*/, ''));
  measurementKeys.filter(key => log[key] != null).forEach(key => parts.push(`${measurementFields[key].label}: ${log[key]}${key === 'ph' ? '' : ` ${measurementFields[key].unit}`}`));
  if (log.moistureState) parts.push(`Soil: ${log.moistureState.toLowerCase()}`);
  if (log.rainfallObservation) parts.push(`Rain: ${log.rainfallObservation.toLowerCase()}`);
  if (log.recordingSource === 'schedule') parts.push('Automatically recorded');
  if (log.wateringRepeatChange) parts.push(log.wateringRepeatChange.enabled ? 'Repeating watering updated' : 'Repeating watering stopped');
  return parts.join('\n');
}
export function historyDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export function historyRows(entries: JournalEntry[], plant: Plant, complete: boolean) {
  const rows = [...entries];
  // Creation has its own real timestamp. Never infer it from planting age.
  if (complete && plant.createdAt?.toDate && !rows.some(entry => entry.id === '__created' || entry.id === 'setup-created' || entry.description?.startsWith('Plant added to garden.'))) rows.push({ id: '__created', type: 'note', timestamp: plant.createdAt, updatedBy: '', description: 'Plant added to your collection.' });
  return rows.map(log => ({ log, day: journalEntryDay(log, plant.locationTimeZone), time: journalEntryTime(log, plant.locationTimeZone) }))
    .sort((a, b) => b.day.localeCompare(a.day) || b.log.timestamp.toMillis() - a.log.timestamp.toMillis() || b.log.id.localeCompare(a.log.id));
}
