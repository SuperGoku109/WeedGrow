import React from 'react';
import { Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import ActionDialog from './ActionDialog';
export function useDiscardGuard(dirty: boolean, onDiscard?: () => Promise<void> | void) {
  const navigation = useNavigation();
  const [open, setOpen] = React.useState(false); const [allowed, setAllowed] = React.useState(false);
  React.useEffect(() => { if (!dirty) setAllowed(false); }, [dirty]);
  const pending = React.useRef<(() => void) | null>(null);
  const requestClose = (action: () => void) => { if (!dirty || allowed) action(); else { pending.current = action; setOpen(true); } };
  usePreventRemove(dirty && !allowed, ({ data }) => { pending.current = () => navigation.dispatch(data.action); setOpen(true); });
  React.useEffect(() => { if (allowed && pending.current) { const action = pending.current; pending.current = null; action(); } }, [allowed]);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !dirty || allowed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, allowed]);
  const finish = (action: () => void) => { pending.current = action; setAllowed(true); };
  return { requestClose, finish, dialog: open ? <ActionDialog title="Discard unsaved changes?" description="Your changes have not been saved. Keep editing to finish, or discard them to leave." confirmLabel="Discard changes" onClose={() => setOpen(false)} onConfirm={async () => { await onDiscard?.(); setAllowed(true); }} /> : null };
}
