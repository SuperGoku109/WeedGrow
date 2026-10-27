import { requireUserId } from '@/services/session';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePlants } from '@/features/addGroup/hooks/usePlants';
import { validCoordinates, type Coordinates } from '@/features/location/locationService';
import { createGroup } from '@/features/groups/api/groupApi'; // <-- Use the correct API

// Use the same user ID as the home screen


export function useAddGroup() {
  const router = useRouter();
  const { plants, loading, error } = usePlants();
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [groupLocationPlantId, setGroupLocationPlantId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submittingRef = useRef(false);

  const handleTogglePlant = (id: string) => {
    setSelectedPlantIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (submittingRef.current) return;
    if (!groupName.trim() || selectedPlantIds.length === 0) {
      setSubmitError('Enter a garden name and select at least one plant.');
      return;
    }
    if (!validCoordinates(location) || locationBusy) {
      setSubmitError('Choose a location for your garden to start collecting weather.');
      return;
    }
    submittingRef.current = true;
    setSubmitError('');
    setSubmitting(true);
    try {
      const environment = plants.find(p => p.id === selectedPlantIds[0])?.environment;
      if (!environment) {
        setSubmitError('Select a plant with an environment to continue.');
        return;
      }
      const id = await createGroup({
        name: groupName.trim(),
        plantIds: selectedPlantIds,
        environment,
        location,
        locationLabel,
        createdBy: requireUserId(),
      });
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch {
      setSubmitError('Could not create your garden. Your selections are still here; please try again.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return {
    plants,
    loading,
    error,
    selectedPlantIds,
    setSelectedPlantIds,
    groupLocationPlantId,
    setGroupLocationPlantId,
    groupName,
    location, setLocation, locationLabel, setLocationLabel, locationBusy, setLocationBusy,
    setGroupName,
    submitting,
    submitError,
    handleTogglePlant,
    handleCreateGroup,
  };
}
