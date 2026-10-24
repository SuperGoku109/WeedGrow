// firestoreModels.ts

// ================================
// 📁 Top-level: /plants/{plantId}
// ================================
export interface Plant {
    name: string;
    strain: string;
    strainType?: string;
    startedOn?: string | null;
    ageEstimated?: boolean;
    ageRecordedAt?: FirebaseFirestore.Timestamp;
    groupId?: string | null;
    locationLabel?: string | null;
    locationMode?: 'custom' | 'space';
    locationRevision?: number;
    locationChangedAt?: FirebaseFirestore.Timestamp;
    currentWeather?: WeatherCacheEntry | null;
    weatherHistoryBefore?: string;
    locationTimeZone?: string | null;
    careSnoozes?: { watering?: number; feeding?: number };
    careSkips?: { watering?: string; feeding?: string };
    owners: string[];
    growthStage: 'germination' | 'seedling' | 'vegetative' | 'flowering' | 'clone';
    ageDays?: number;
    ageKnown?: boolean;
    status: 'active' | 'archived' | 'harvested' | 'dead';
    environment: 'outdoor' | 'greenhouse' | 'indoor';
    plantedIn: 'pot' | 'ground';
  
    potSize?: string;
    sunlightExposure?: string;
    wateringFrequency?: string;
    fertilizer?: string;
    feedingFrequency?: string;
    pests?: string[];
    trainingTags?: string[];
    notes?: string;
    imageUri?: string;
    waterLevel?: number; // 0-1 representing current watering level
    height?: number;
    soilType?: string;
    soilPh?: string;
    permanentProtection?: string;
    companionPlants?: string[];
    environmentNotes?: string;
  
    location?: {
      lat: number;
      lng: number;
    };
    locationNickname?: string;

    // Link to sensor profile (optional)
    sensorProfileId?: string;
  
    reminderSchedule?: {
      type: 'interval' | 'custom' | 'none';
      intervalDays?: number;
      customDays?: string[];
      timeOfDay?: string;
    };
  
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
  }
  
  // ================================
  // 📁 Subcollection: /plants/{plantId}/logs/{logId}
  // ================================
  export interface PlantLog {
    calendarDay?: string;
    timeZone?: string;
    movement?: { from: { lat: number; lng: number } | null; to: { lat: number; lng: number } | null; fromLabel: string; toLabel: string; revision: number };
    mutationId?: string;
    editedAt?: FirebaseFirestore.Timestamp;
    waterMl?: number;
    nutrientMlPerL?: number;
    ph?: number;
    heightCm?: number;
    soilMoisture?: number;
    category?: 'watering' | 'feeding' | 'pests' | 'training' | 'health' | 'notes';
    timestamp: FirebaseFirestore.Timestamp;
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
    fetchedAt: FirebaseFirestore.Timestamp;
    forecasted: boolean;
    source: string;
    temperature: number;
    humidity: number;
    windSpeed: number; // Provider metres/second; convert only at presentation.
    rainfall: number;
    uvIndex: number;
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
    lastUpdated: FirebaseFirestore.Timestamp;
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
    createdAt: FirebaseFirestore.Timestamp;
}

// ================================
// 📁 Top-level: /groups/{groupId}
// ================================
export interface Group {
  locationLabel?: string;
  name: string;
  environment: 'outdoor' | 'indoor' | 'greenhouse';
  plantIds: string[];
  location: { lat: number; lng: number } | null;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  /** Optional: sensor profile for indoor/greenhouse groups */
  sensorProfileId?: string;
  /** Optional: which plant's location/weather to use for this group */
  weatherSourcePlantId?: string;
}
