// features/plants/hooks/useLogHistoryCalendar.ts

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { addPlantLog } from '@/lib/logs/addPlantLog';
import { PlantLog } from '@/firestoreModels';
import { LogType } from '@/ui/WeedGrowLogTypeSheet';

export function useLogHistoryCalendar(plantId?: string) {
  const [logsByDate, setLogsByDate] = useState<Record<string, PlantLog[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logTypeSheetVisible, setLogTypeSheetVisible] = useState(false);
  const [logFormVisible, setLogFormVisible] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<LogType | null>(null);
  const [pendingLogDate, setPendingLogDate] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!plantId) return;
    const snap = await getDocs(collection(db, 'plants', String(plantId), 'logs'));
    const logs: PlantLog[] = snap.docs.map((d) => d.data() as PlantLog);
    const byDate: Record<string, PlantLog[]> = {};
    logs.forEach(log => {
      const date = log.timestamp?.toDate?.().toISOString().split('T')[0];
      if (date) {
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(log);
      }
    });
    setLogsByDate(byDate);
  }, [plantId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getMarkedDates = () => {
    const marks: any = {};
    Object.keys(logsByDate).forEach(date => {
      marks[date] = { marked: true, dotColor: '#2563eb' };
    });
    if (selectedDate) {
      marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: '#2563eb' };
    }
    return marks;
  };

  const handleAddLog = (date: string) => {
    setPendingLogDate(date);
    setLogTypeSheetVisible(true);
    setSelectedLogType(null);
  };

  const handleSelectLogType = (type: LogType) => {
    setSelectedLogType(type);
    setLogTypeSheetVisible(false);
    setTimeout(() => setLogFormVisible(true), 100);
  };

  const handleSubmitLog = async ({ description }: { description: string }) => {
    if (!plantId || !pendingLogDate || !selectedLogType) return;
    const logTypeMap: Record<LogType, PlantLog['type']> = {
      watering: 'watering',
      feeding: 'fertilizing',
      pests: 'note',
      training: 'training',
      health: 'note',
      notes: 'note',
    };
    await addPlantLog(String(plantId), {
      type: logTypeMap[selectedLogType],
      description,
      updatedBy: '',
    }, pendingLogDate);

    await fetchLogs();
    setLogFormVisible(false);
    setSelectedLogType(null);
    setPendingLogDate(null);
  };

  const closeTypeSheet = () => {
    setLogTypeSheetVisible(false);
    setSelectedLogType(null);
    setLogFormVisible(false);
  };

  const cancelLogForm = () => {
    setLogFormVisible(false);
    setSelectedLogType(null);
    setPendingLogDate(null);
  };

  return {
    logsByDate,
    selectedDate,
    setSelectedDate,
    getMarkedDates,
    logTypeSheetVisible,
    logFormVisible,
    selectedLogType,
    handleAddLog,
    handleSelectLogType,
    handleSubmitLog,
    closeTypeSheet,
    cancelLogForm,
  };
}
