// MediaForm.tsx
// This component renders the Final Touches step of the Add Plant flow.
// It allows the user to add a photo and notes for the plant before finishing the process.

import AppNotice from '@/ui/AppNotice';
import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { Button } from 'react-native-paper';
import { ThemedText } from '@/ui/ThemedText';
import { WeedGrowCard } from '@/ui/WeedGrowCard';
import { WeedGrowFormSection } from '@/ui/WeedGrowFormSection';
import { WeedGrowTextInput } from '@/ui/WeedGrowTextInput';
import { WeedGrowButtonRow } from '@/ui/WeedGrowButtonRow';
import type { PlantForm } from '@/features/plants/form/PlantForm';
import type { Step5MediaLogic } from '../hooks/useStep5Media';

// Props for the MediaForm component
interface MediaFormProps {
  form: PlantForm; // Form state object
  logic: Step5MediaLogic; // Logic handlers for media step
  next(): void; // Callback to go to next step
  back(): void; // Callback to go to previous step
}

// Title section for the form
const TitleSection = () => (
  <>
    <ThemedText type="title" style={{ textAlign: 'center', fontSize: 24 }}>
      📝 Final Touches
    </ThemedText>
    <ThemedText style={{ textAlign: 'center', marginBottom: 10, fontSize: 15 }}>
      Add a photo and any final notes for your plant.
    </ThemedText>
  </>
);

// Section for adding a photo (camera or gallery)
const PhotoSection = ({ form, logic }: { form: PlantForm; logic: Step5MediaLogic }) => (
  <WeedGrowFormSection label="Photo">
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18, justifyContent: 'center' }}>
      {/* Button to take a photo */}
      <Button mode="outlined" icon="camera" onPress={() => logic.pickImage(true)}>
        Take Photo
      </Button>
      {/* Button to choose from gallery */}
      <Button mode="outlined" icon="image" onPress={() => logic.pickImage(false)}>
        Choose from Gallery
      </Button>
    </View>

    {/* Show selected image if available */}
    {form.imageUri && (
      <Image
        source={{ uri: form.imageUri }}
        style={{ height: 200, width: '100%', maxWidth: 480, borderRadius: 16, borderWidth: 2, borderColor: logic.tint }}
        resizeMode="cover"
      />
    )}
  </WeedGrowFormSection>
);

// Section for adding notes/observations
const NotesSection = ({ form, logic }: { form: PlantForm; logic: Step5MediaLogic }) => (
  <WeedGrowFormSection label="Notes">
    <View style={{ width: '100%', minHeight: 100 }}>
      <WeedGrowTextInput
        label="Observations (optional)"
        value={form.notes ?? ''}
        onChangeText={(val: string) => logic.setField('notes', val)}
        multiline
        placeholder="Add any observations here..."
        icon="note-text"
      />
    </View>
  </WeedGrowFormSection>
);

// Main form component for adding media and notes
export function MediaForm({ form, logic, next, back }: MediaFormProps) {
  return (
    <WeedGrowCard style={{ width: '100%', maxWidth: 480 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        <TitleSection />
        <PhotoSection form={form} logic={logic} />
        <NotesSection form={form} logic={logic} />

        {/* Snackbar to show feedback when a photo is selected */}
        <AppNotice visible={logic.snackVisible} onDismiss={() => logic.setSnackVisible(false)}>
          Photo selected
        </AppNotice>

        {/* Navigation buttons: Back and Next */}
        <WeedGrowButtonRow>
          <Button mode="outlined" onPress={back} style={{ flex: 1 }}>
            Back
          </Button>
          <Button mode="contained" onPress={next} style={{ flex: 1 }}>
            Next
          </Button>
        </WeedGrowButtonRow>
      </ScrollView>
    </WeedGrowCard>
  );
}
