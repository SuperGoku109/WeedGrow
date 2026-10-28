import { useEffect, useState } from 'react';
export function useSlowOperation(busy: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [busy]);
  return busy && slow;
}
