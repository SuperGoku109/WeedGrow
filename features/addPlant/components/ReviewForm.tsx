// ReviewForm.tsx
// This component renders the Review step of the Add Plant flow.
// It displays a summary of the plant's details for final review before saving.

import React from 'react'
import { View, ScrollView, Image } from 'react-native'
import { Button } from 'react-native-paper'
import { ThemedText } from '@/ui/ThemedText'
import { WeedGrowCard } from '@/ui/WeedGrowCard'
import { WeedGrowButtonRow } from '@/ui/WeedGrowButtonRow'
import { WeedGrowFormSection } from '@/ui/WeedGrowFormSection'
import type { PlantForm } from '@/features/plants/form/PlantForm'
import type { Step6ReviewLogic } from '../hooks/useStep6Review'

// Props for the ReviewForm component
interface ReviewFormProps {
  form: PlantForm // Form state object
  logic: Step6ReviewLogic // Logic handlers for review step
  back(): void // Callback to go to previous step
}

// Main form component for reviewing plant details before saving
export function ReviewForm({ form, logic, back }: ReviewFormProps) {
  return (
    <WeedGrowCard style={{ width: '100%', maxWidth: 480 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <ThemedText type="title" style={{ textAlign: 'center', fontSize: 24 }}>
          🌱 Review Your Plant
        </ThemedText>

        {/* Show plant image if available */}
        {form.imageUri && (
          <Image
            source={{ uri: form.imageUri }}
            style={{ height: 180, width: '100%', borderRadius: 16, borderWidth: 2, borderColor: logic.tint }}
            resizeMode="cover"
          />
        )}

        {/* Summary section with key plant details */}
        <WeedGrowFormSection label="Summary">
          <View style={{ gap: 8 }}>
            <TextRow label="Name" value={form.name} />
            <TextRow label="Strain" value={form.strain} />
            <TextRow label="Growth Stage" value={form.growthStage} />
            <TextRow label="Environment" value={form.environment} />
          </View>
        </WeedGrowFormSection>

        {/* Navigation buttons: Back and Save */}
        <WeedGrowButtonRow>
          <Button mode="outlined" onPress={back} style={{ flex: 1 }}>
            Back
          </Button>
          <Button mode="contained" onPress={logic.handleSave} loading={logic.saving} style={{ flex: 1 }}>
            Save Plant
          </Button>
        </WeedGrowButtonRow>
      </ScrollView>
    </WeedGrowCard>
  )
}

// Helper component for displaying a label-value row
function TextRow({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <ThemedText style={{ fontWeight: '600' }}>{label}</ThemedText>
      <ThemedText>{value == null || value === '' ? 'Not set' : String(value)}</ThemedText>
    </View>
  )
}
