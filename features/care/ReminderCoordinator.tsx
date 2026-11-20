import { useAppTheme } from '@/hooks/useAppTheme';
import { effectiveSchedule } from '@/lib/care/reminderSchedules';
import { contextualCareTasks } from '@/lib/care/contextualReminders';
import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useSession } from '@/services/session';
import { usePreferences } from '@/hooks/usePreferences';
import { useCareSnoozes } from '@/hooks/useCareSnoozes';
import { useWateringSuggestions } from '@/features/home/hooks/useWateringSuggestions';
import { syncCareRecommendations, syncReminders } from '@/services/reminders';
import { reminderDue } from '@/lib/care/careTasks';
import { useCareTasks } from './useCareTasks';
import { syncStageReminders } from '@/services/stageReminders';
import { findHandledCareTip } from '@/lib/care/careTipHistory';
import { recommendationSignature } from '@/lib/careAlgorithm/outdoorIntelligence';
export default function ReminderCoordinator() {
  const { user } = useSession();
  const { preferences } = usePreferences(user?.uid);
  React.useEffect(() => { if (!user || !preferences.reminders) void syncStageReminders(undefined, [], false).catch(() => {}); }, [user, preferences.reminders]);
  React.useEffect(() => { if (!user || !preferences.reminders) { void syncReminders(undefined, [], false).catch(() => {}); void syncCareRecommendations(undefined, [], false).catch(() => {}); } }, [user, preferences.reminders]);
  return user && preferences.reminders && Platform.OS !== 'web' ? <ActiveReminders /> : null;
}
function ActiveReminders() {
  const t = useAppTheme();
  const { user } = useSession();
  const { preferences } = usePreferences(user?.uid);
  const { snoozes } = useCareSnoozes(user?.uid);
  const { tasks, plants, loading, error, plantLoading, plantError, now } = useCareTasks();
  const intelligence = useWateringSuggestions(plants);
  const [intelligenceMessage, setIntelligenceMessage] = React.useState('');
  const resolvedKey = JSON.stringify(intelligence.insights.flatMap(i => i.careEvaluation?.outdoor?.resolvedRecommendationIds ?? []));
  const plantById = new Map(plants.map(plant => [plant.id, plant]));
  const recommendations = intelligence.insights.flatMap(i => i.careEvaluation?.outdoor?.recommendations ?? []);
  const handledIds = new Set(recommendations.filter(r => findHandledCareTip(plantById.get(r.plantId), recommendationSignature(r), now, r.type)).map(r => r.id));
  const handledKey = JSON.stringify([...handledIds].sort());
  const remaining = recommendations.filter(r => !handledIds.has(r.id));
  const recommendationKey = JSON.stringify(remaining.filter(r => {
    if (r.type !== 'watering') return true;
    const plant = plantById.get(r.plantId);
    return !!plant && effectiveSchedule(plant, 'watering').type === 'smart';
  }));
  React.useEffect(() => {
    if (intelligence.loading || intelligence.error || intelligence.stale) return;
    void syncCareRecommendations(user?.uid, JSON.parse(recommendationKey), preferences.reminders, JSON.parse(resolvedKey), JSON.parse(handledKey)).then(() => setIntelligenceMessage('')).catch(() => setIntelligenceMessage('Device care alerts could not be updated. Retry from care advice or check notification permissions.'));
  }, [user?.uid, recommendationKey, resolvedKey, handledKey, preferences.reminders, intelligence.loading, intelligence.error, intelligence.stale]);
  const [message, setMessage] = React.useState('');
  const [stageMessage, setStageMessage] = React.useState('');
  const stageKey = JSON.stringify(plants);
  const stageMinute = Math.floor(Date.now() / 60000);
  const weatherAlerts = remaining.filter(r => r.status === 'active' && r.priority === 'HIGH');
  const weatherBusyUntil = weatherAlerts.length ? stageMinute * 60000 + 3600000 : 0;
  // Re-evaluate reservations from the live plant records; completed/harvested plants remain eligible.
  React.useEffect(() => {
    if (plantLoading && !plantError) return;
    void syncStageReminders(user?.uid, plantError ? [] : JSON.parse(stageKey), preferences.reminders, weatherBusyUntil).then(() => setStageMessage('')).catch(() => setStageMessage('Stage reminders could not be updated. Check notification permissions and connection.'));
  }, [user?.uid, stageKey, preferences.reminders, plantLoading, plantError, stageMinute, weatherBusyUntil]);
  // Serialize only meaningful task changes, not the once-per-minute clock.
  const evaluated = new Map(intelligence.insights.flatMap(i => i.careEvaluation ? [[i.plantId, i.careEvaluation] as const] : []));
  const smartTasks = contextualCareTasks(tasks, evaluated, Date.now() / 1000);
  const signature = JSON.stringify(smartTasks.map(task => ({ ...task, due: reminderDue(task, snoozes[task.id] || 0).toISOString() })));
  React.useEffect(() => {
    if (user && loading && !error && preferences.reminders) return;
    let active = true;
    const adjusted = JSON.parse(signature).map((task: { due: string }) => ({ ...task, due: new Date(task.due) }));
    void syncReminders(user?.uid, error ? [] : adjusted, preferences.reminders).then(() => { if (active) setMessage(''); }).catch(() => { if (active) setMessage('Device reminders could not be updated. Open Settings to check permissions.'); });
    return () => { active = false; };
  }, [user, preferences.reminders, loading, error, signature]);
  const feedback = message || intelligenceMessage || stageMessage;
  return feedback ? <View style={{ backgroundColor: t.surface, padding: 10 }}><Text accessibilityRole="alert" style={{ color: t.warm }}>{feedback}</Text></View> : null;
}
