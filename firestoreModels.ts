// firestoreModels.ts

// ================================
// 📁 Top-level: /plants/{plantId}
// ================================
export interface Plant {
    name: string;
    strain: string;
    owners: string[];
    growthStage: 'germination' | 'seedling' | 'vegetative' | 'flowering';
    ageDays?: number;
    status: 'active' | 'archived' | 'harvested' | 'dead';
    environment: 'outdoor' | 'greenhouse' | 'indoor';
    plantedIn: 'pot' | 'ground';
  
    potSize?: string;
    sunlightExposure?: string;
    wateringFrequency?: string;
    fertilizer?: string;
    pests?: string[];
    trainingTags?: string[];
    notes?: string;
    imageUri?: string;
    waterLevel?: number; // 0-1 representing current watering level
    height?: number;
  
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
    category?: 'watering' | 'feeding' | 'pests' | 'training' | 'health' | 'notes';
    timestamp: FirebaseFirestore.Timestamp;
    type: 'watering' | 'fertilizing' | 'note' | 'photo' | 'training' | 'stage_change' | 'harvest';
    description?: string;
    photoUri?: string;
    updatedBy: string; // UID
  }
  
  // ================================
  // 📁 Subcollection: /plants/{plantId}/weatherCache/{YYYY-MM-DD}
  // ================================
export interface WeatherCacheEntry {
    date: string; // 'YYYY-MM-DD'
    fetchedAt: FirebaseFirestore.Timestamp;
    forecasted: boolean;
    source: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    rainfall: number;
    uvIndex: number;
    weatherSummary: string;
    hourlySummary?: {
      peakTemp: number;
      rainHours: number;
    };
    dewPoint?: number;
    cloudCoverage?: number;
    windGust?: number;
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
