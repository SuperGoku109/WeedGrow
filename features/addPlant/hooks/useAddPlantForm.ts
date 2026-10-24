import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import { readPreferences } from '@/services/preferences';
import { useSession } from '@/services/session';
import { createPlantId } from '../api/savePlant';
import { draftKey, INITIAL_PLANT_FORM, readDraft, writeDraft, removeDraft, writeDraftOnExit, type PlantDraft } from '../draftStorage';

export function useAddPlantForm() {
  const { user, loading: sessionLoading } = useSession();
  const [form, setForm] = useState<PlantForm>(INITIAL_PLANT_FORM);
  const [step, setStep] = useState(0);
  const [plantId, setPlantId] = useState(createPlantId);
  const [ready, setReady] = useState(false);
  const [offer, setOffer] = useState<PlantDraft | null>(null);
  const [draftError, setDraftError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const key = draftKey(user?.uid);
  const activeKey = useRef(key);
  const latest = useRef<PlantDraft>({ version: 1, form, step, plantId, savedAt: '' });
  const writes = useRef(Promise.resolve());
  const cleared = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = { version: 1, form, step, plantId, savedAt: new Date().toISOString() };
  const enqueue = useCallback((task: () => Promise<void>) => {
    writes.current = writes.current.catch(() => {}).then(task);
    return writes.current;
  }, []);
  const flushDraft = useCallback(async () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    if (cleared.current) return;
    const snapshot = latest.current;
    if (!snapshot.form.name && !snapshot.form.growthStage && !snapshot.form.imageUri && snapshot.step === 0) return;
    const targetKey = activeKey.current;
    try { await enqueue(() => writeDraft(targetKey, snapshot)); setDraftError(''); setSavedAt(snapshot.savedAt); }
    catch { setDraftError('Your draft could not be saved on this device. Keep this page open or try freeing some device storage.'); throw new Error('Draft could not be saved.'); }
  }, [enqueue]);
  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    // A device draft can follow the user who signs in during this flow. An
    // existing account's draft never carries into a different account.
    const signingIn = activeKey.current === draftKey() && !!user;
    activeKey.current = key;
    setReady(false);
    if (signingIn && (latest.current.form.name || latest.current.step)) {
      setReady(true); void flushDraft().catch(() => {}); return;
    }
    Promise.all([readDraft(key), readPreferences(user?.uid)]).then(([draft, preferences]) => {
      if (!active) return;
      setForm({ ...INITIAL_PLANT_FORM, environment: preferences.defaultEnvironment }); setStep(0); setPlantId(createPlantId()); setOffer(draft); cleared.current = false;
    }).catch(() => { if (active) setDraftError('Saved drafts could not be read on this device.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key, user, sessionLoading, flushDraft]);
  useEffect(() => {
    if (!ready || offer || cleared.current) return;
    pending.current = setTimeout(() => { void flushDraft().catch(() => {}); }, 400);
    return () => { if (pending.current) clearTimeout(pending.current); };
  }, [form, step, plantId, ready, offer, flushDraft]);
  useEffect(() => {
    const flush = () => { if (ready && !offer) void flushDraft().catch(() => {}); };
    const exit = () => {
      const snapshot = latest.current;
      const meaningful = !!(snapshot.form.name || snapshot.form.growthStage || snapshot.form.imageUri || snapshot.step);
      if (ready && !offer && !cleared.current && meaningful) { try { writeDraftOnExit(activeKey.current, snapshot); } catch { /* The in-app draft status already reports storage failures. */ } }
    };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') flush(); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('pagehide', exit);
    return () => { subscription.remove(); if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('pagehide', exit); };
  }, [ready, offer, flushDraft]);
  const setField = useCallback(<K extends keyof PlantForm>(field: K, value: PlantForm[K]) => {
    cleared.current = false;
    setForm((prev: PlantForm) => ({ ...prev, [field]: value }));
  }, []);
  const clearDraft = useCallback(async () => {
    cleared.current = true;
    if (pending.current) clearTimeout(pending.current);
    await enqueue(() => removeDraft(activeKey.current));
    if (user) await enqueue(() => removeDraft(draftKey()));
    setSavedAt(''); setOffer(null);
  }, [enqueue, user]);
  const resetForm = useCallback(async () => {
    await clearDraft(); const preferences = await readPreferences(user?.uid); setForm({ ...INITIAL_PLANT_FORM, environment: preferences.defaultEnvironment }); setStep(0); setPlantId(createPlantId()); cleared.current = false;
  }, [clearDraft, user?.uid]);
  const resumeDraft = () => {
    if (!offer) return;
    setForm(offer.form); setStep(offer.step); setPlantId(offer.plantId); setSavedAt(offer.savedAt); setOffer(null); cleared.current = false;
  };
  const replaceForm = (next: PlantForm) => { cleared.current = false; setForm(next); };
  return { form, setField, replaceForm, resetForm, step, setStep, plantId, ready, offer, resumeDraft, clearDraft, flushDraft, draftError, savedAt };
}
