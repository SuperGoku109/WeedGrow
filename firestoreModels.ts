import type { Timestamp } from 'firebase/firestore';
export interface ProgressPic { calendarDay?: string; timeZone?: string; id: string; imageUrl: string; timestamp?: Timestamp; caption?: string }
// firestoreModels.ts

// ================================
// 📁 Top-level: /plants/{plantId}
// ================================
export interface CareSummaryEntry { id: string; mutationId?: string; timestamp: Timestamp; calendarDay?: string; timeZone?: string }
export interface CareSummary { version: 1; revision: number; watering: CareSummaryEntry | null; fertilizing: CareSummaryEntry | null }
export interface PlantReminderSchedule { type: 'interval' | 'custom' | 'smart' | 'none'; intervalDays?: number; customDays?: string[]; timeOfDay?: string }
export interface Plant {
    /** Confirmed calendar dates use the same YYYY-MM-DD convention as startedOn. */
    stageStartedOn?: string | null;
    stageStartedOnEstimated?: boolean;
    ageEstimateSource?: 'stage' | null;
    germinationStartedOn?: string | null;
    emergedOn?: string | null;
    preflowerObservedOn?: string | null;
    floweringStartedOn?: string | null;
    floweringPhase?: 'late' | null;
    lateFloweringStartedOn?: string | null;
    harvestedOn?: string | null;
    lastStageReviewedOn?: string | null;
    stageTrackingVersion?: 1;
    stageRevision?: number;
    growthProfile?: import('./lib/plants/growthTracking').GrowthProfile;
    stageReview?: import('./lib/plants/growthTracking').StageReview | null;
    stagePush?: import('./lib/plants/growthTracking').StagePush | null;
    stageReminders?: { enabled: boolean; quietStartHour?: number; quietEndHour?: number };
    postHarvestTracking?: boolean;
    waterLedgerRevision?: number;
    setupLedgerRevision?: number;
    /** Server-owned pointer; clients cannot write or restore it. */
    careEvaluationRevision?: string | null;
    /** Server-owned due index; null means no automatic re-evaluation is scheduled. */
    careNextEvaluationUtc?: number | null;
    /** Server-enrolled protocol: care-log writes must atomically advance careRevision. */
    careEventProtocol?: 1;
    careMedium?: string | null;
    rainReception?: { soil: 'yes' | 'no' | 'partial' | 'unknown'; canopy: 'yes' | 'no' | 'partial' | 'unknown' };
    careRevision?: number;
    careSummary?: CareSummary | null;
    name: string;
    strain: string;
    strainType?: string;
    startedOn?: string | null;
    ageEstimated?: boolean;
    ageRecordedAt?: Timestamp;
    groupId?: string | null;
    locationLabel?: string | null;
    locationMode?: 'custom' | 'space';
    locationRevision?: number;
    locationChangedAt?: Timestamp;
    currentWeather?: WeatherCacheEntry | null;
    weatherHistoryBefore?: string;
    locationTimeZone?: string | null;
    careSnoozes?: { watering?: number; feeding?: number };
    careSkips?: { watering?: string; feeding?: string };
    deleting?: boolean;
    wateringRepeat?: import('./lib/logs/wateringRepeat').WateringRepeat | null;
    harvest?: { date: string; weightGrams?: number; notes: string; recordId: string };
    owners: string[];
    growthStage: 'unknown' | 'germination' | 'seedling' | 'vegetative' | 'flowering' | 'clone' | 'harvested' | 'drying' | 'curing' | 'completed';
    ageDays?: number | null;
    ageKnown?: boolean;
    status: 'active' | 'archived' | 'harvested' | 'dead';
    environment: 'outdoor' | 'greenhouse' | 'indoor';
    plantedIn: 'pot' | 'ground';
  
    potSize?: string | null;
    potType?: typeof import('./lib/care/plantContext').POT_TYPES[number] | null;
    growingSite?: typeof import('./lib/care/plantContext').GROWING_SITES[number] | null;
    potDrainage?: typeof import('./lib/care/plantContext').DRAINAGE_TYPES[number] | null;
    fertilizerForm?: typeof import('./lib/care/plantContext').FERTILIZER_FORMS[number] | null;
    potMaterial?: typeof import('./lib/care/plantContext').POT_MATERIALS[number] | null;
    sunlightExposure?: string | null;
    wateringFrequency?: string | null;
    fertilizer?: string | null;
    feedingFrequency?: string | null;
    pests?: string[];
    trainingTags?: string[];
    notes?: string | null;
    imageUri?: string | null;
    waterLevel?: number; // 0-1 representing current watering level
    height?: number | null;
    soilType?: string | null;
    soilPh?: string | null;
    permanentProtection?: string | null;
    companionPlants?: string[];
    environmentNotes?: string | null;
  
    location?: {
      lat: number;
      lng: number;
    } | null;
    locationNickname?: string | null;

    // Link to sensor profile (optional)
    sensorProfileId?: string | null;
  
    reminderSchedule?: PlantReminderSchedule;
    feedingReminderSchedule?: PlantReminderSchedule;
  
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
  }
  
  // ================================
  // 📁 Subcollection: /plants/{plantId}/logs/{logId}
  // ================================
  export interface PlantLog {
    fromStage?: Plant['growthStage'];
    toStage?: Plant['growthStage'];
    stageRevision?: number;
    stageReview?: import('./lib/plants/growthTracking').StageReview;
    occurrencePrecision?: 'date' | 'time';
    recordedAt?: Timestamp;
    calendarDay?: string;
    timeZone?: string;
    movement?: { from: { lat: number; lng: number } | null; to: { lat: number; lng: number } | null; fromLabel: string; toLabel: string; revision: number };
    mutationId?: string;
    editedAt?: Timestamp;
    waterMl?: number;
    nutrientMlPerL?: number;
    ph?: number;
    heightCm?: number;
    /** Legacy numeric measurement; never converted to inferred categories. */
    soilMoisture?: number;
    moistureState?: 'DRY' | 'MOIST' | 'WET';
    moistureConfiguration?: string;
    /** Rain explicitly reported by the user; never a watering event. */
    rainfallObservation?: 'LIGHT' | 'MODERATE' | 'HEAVY';
    inspectionFeedback?: 'useful' | 'too_early' | 'too_late';
    wateringRepeatChange?: import('./lib/logs/wateringRepeat').WateringRepeatChange;
    recordingSource?: 'schedule';
    category?: 'watering' | 'feeding' | 'pests' | 'training' | 'health' | 'measurements' | 'repotting' | 'flushing' | 'notes';
    timestamp: Timestamp;
    type: 'watering' | 'fertilizing' | 'note' | 'photo' | 'training' | 'stage_change' | 'harvest';
    description?: string;
    photoUri?: string;
    careCheck?: 'powderyMildew' | 'rootRot';
    inspectionResult?: 'no_symptoms';
    updatedBy: string; // UID
  }
  
  // ================================
  // 📁 Subcollection: /plants/{plantId}/weatherCache/{YYYY-MM-DD}
  // ================================
export interface WeatherCacheEntry {
    timeZone?: string;
    sourceCoordinates?: { lat: number; lng: number };
    locationRevision?: number;
    locationLabel?: string;
    previousLocations?: Omit<WeatherCacheEntry, 'previousLocations'>[];
    date: string; // 'YYYY-MM-DD'
    fetchedAt: Timestamp;
    forecasted: boolean;
    source: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number; // Provider metres/second; convert only at presentation.
    rainfall?: number;
    uvIndex?: number;
    weatherDataVersion?: 2 | 3;
    rainIntervalSeconds?: number;
    qualityNotes?: string[];
    temperatureBasis?: 'model';
    observationUtc?: number;
    forecastIssue?: 'repeated_point_forecast';
    weatherSummary: string;
    hourlySummary?: {
      peakTemp: number;
      rainHours: number;
    };
    dewPoint?: number;
    cloudCoverage?: number;
    windGust?: number; // Provider metres/second.
    sunrise?: string;
    sunset?: string;
    pop?: number;
    nightHumidity?: number;
    detailedTemps?: {
      morn: number | null;
      day: number | null;
      eve: number | null;
      night: number | null;
      min: number | null;
      max: number | null;
    };
}
  
  // ================================
  // 📁 /users/{userId}/settings
  // ================================
  export interface UserSettings {
    defaultEnvironment: 'indoor' | 'outdoor' | 'greenhouse';
    preferredUnits: 'metric' | 'imperial';
    darkMode: boolean;
    defaultReminderTime: string;
    notificationPreferences: {
      wateringReminders: boolean;
      newLogActivity: boolean;
      tips: boolean;
    };
  }
  
  // ================================
  // 📁 /notifications/{userId}
  // ================================
  export interface NotificationProfile {
    deviceTokens: string[];
    subscribedTopics: string[];
    lastUpdated: Timestamp;
  }
  
  // ================================
  // 📁 /analytics/{userId}_year_{year}
  // ================================
  export interface UserAnalytics {
    year: number;
    totalWaterings: number;
    totalFertilizations: number;
    completedStages: {
      germination: number;
      seedling: number;
      vegetative: number;
      flowering: number;
    };
    pestsEncountered: string[];
    mostUsedTrainingTags: string[];
    totalPlantsCreated: number;
    totalPlantsArchived: number;
  }
  
  // ================================
  // 📁 /invites/{inviteId}
  // ================================
export interface Invite {
    invitedBy: string; // userId
    invitedUserEmail: string;
    plantId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp | null;
}

// ================================
// 📁 Top-level: /groups/{groupId}
// ================================
export interface Group {
  /** Outdoor conditions at the garden pin, independent of member plants. */
  currentWeather?: WeatherCacheEntry | null;
  locationLabel?: string;
  name: string;
  environment: 'outdoor' | 'indoor' | 'greenhouse';
  plantIds: string[];
  location: { lat: number; lng: number } | null;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  /** Optional: sensor profile for indoor/greenhouse groups */
  sensorProfileId?: string | null;
  /** Optional: which plant's location/weather to use for this group */
  weatherSourcePlantId?: string | null;
}
