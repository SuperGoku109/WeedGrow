import type { CareTask } from '@/lib/care/careTasks';
export async function requestReminderPermission() { throw new Error('Scheduled device reminders are available in the installed mobile app. This browser shows the care checklist while open.'); }
export async function syncReminders(_uid: string | undefined, _tasks: CareTask[], _enabled: boolean) { return; }
