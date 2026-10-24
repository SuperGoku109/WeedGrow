import React from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
export default function NotificationNavigation() {
  const { user, loading } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (loading) return;
    let active = true;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (!active || !user || data?.ownerUid !== user.uid || typeof data.plantId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(data.plantId)) return;
      router.push({ pathname: '/plant/[id]', params: { id: data.plantId } });
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => { active = false; subscription.remove(); };
  }, [user, loading, router]);
  return null;
}
