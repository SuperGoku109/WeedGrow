import React from 'react';
import { readRememberedWateringAmount } from '@/services/wateringAmount';

export function useRememberedWateringAmount(plantId: string, uid?: string) {
  const key = uid ? `${uid}:${plantId}` : '';
  const [saved, setSaved] = React.useState({ key: '', amount: '' });
  React.useEffect(() => {
    if (!uid) return;
    let active = true;
    void readRememberedWateringAmount(uid, plantId).then(amount => { if (active) setSaved({ key, amount }); });
    return () => { active = false; };
  }, [key, uid, plantId]);
  return saved.key === key ? saved.amount : '';
}
