// LocationForm.tsx
// This component renders the Location step of the Add Plant flow.
// It allows the user to set the plant's physical location using a map and nickname, and optionally use device geolocation.

import React, { memo, useCallback } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { Button } from 'react-native-paper'
import { ThemedText } from '@/ui/ThemedText'
import { WeedGrowCard } from '@/ui/WeedGrowCard'
import { WeedGrowFormSection } from '@/ui/WeedGrowFormSection'
import { WeedGrowButtonRow } from '@/ui/WeedGrowButtonRow'
import LocationPicker from '@/features/location/LocationPicker'
import { AnimatedMakikoInput } from '@/components/ui/AnimatedMakikoInput'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { WeedGrowCardBackground } from '@/components/ui/WeedGrowCardBackground'

import type { PlantForm } from '@/features/plants/form/PlantForm'
import type { Step3LocationLogic } from '../hooks/useStep3Location'

// Props for the LocationForm component
interface LocationFormProps {
  form: PlantForm // Form state object
  logic: Step3LocationLogic // Logic handlers for location step
  next(): void // Callback to go to next step
  back(): void // Callback to go to previous step
}

// Main form component for entering plant location
export const LocationForm = memo(function LocationForm({ form, logic, next, back }: LocationFormProps) {
  const handleLocationNicknameChange = useCallback((val: string) => logic.setField('locationNickname', val), [logic])


  return (
    <WeedGrowCard style={styles.card}>
      <WeedGrowCardBackground>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <ThemedText type="title" style={styles.title}>
            Where is your plant?
          </ThemedText>

          {/* Section: Location Details (nickname and geolocation) */}
          <WeedGrowFormSection>
            {/* Button to use device geolocation */}
            <Button
              icon="crosshairs-gps"
              loading={logic.loading}
              onPress={logic.getLocation}
              style={styles.locationButton}
              labelStyle={styles.locationButtonLabel}
              mode="contained"
            >
              Use My Location
            </Button>

            {/* Input for location nickname */}
            <AnimatedMakikoInput
              label="Location Nickname"
              value={form.locationNickname ?? ""}
              onChangeText={handleLocationNicknameChange}
              iconName="map-marker"
              iconColor={logic.tint}
              iconClass={MaterialCommunityIcons}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              style={styles.input}
            />
          </WeedGrowFormSection>

          {/* Section: Map picker for selecting location */}
          <WeedGrowFormSection label="Map">
            <LocationPicker location={form.location} label={form.locationLabel} onChange={(coords, name) => { logic.setField('location', coords); logic.setField('locationLabel', name); }} />
          </WeedGrowFormSection>

          {/* Navigation buttons: Back and Next */}
          <WeedGrowButtonRow style={styles.buttonRow}>
            <Button mode="outlined" onPress={back} style={styles.button}>
              Back
            </Button>
            <Button mode="contained" onPress={next} disabled={!logic.isValid} style={styles.button}>
              Next
            </Button>
          </WeedGrowButtonRow>
        </ScrollView>
      </WeedGrowCardBackground>
    </WeedGrowCard>
  )
})

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    padding: 0,
  },
  content: {
    padding: 16,
    gap: 16,
    position: 'relative',
    zIndex: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
  },
  locationButton: {
    marginBottom: 5,
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: undefined, // Use logic.tint for backgroundColor if needed
  },
  locationButtonLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    marginBottom: 0,
  },
  mapHint: {
    textAlign: 'center',
    marginTop: 0,
    fontSize: 14,
    marginBottom: 4,
  },
  buttonRow: {
    marginTop: 0,
  },
  button: {
    flex: 1,
  },
})
