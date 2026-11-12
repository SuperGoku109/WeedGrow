# BudBuddy Firebase Firestore Schema

This document describes the structure of the Firestore database used in the BudBuddy app.
It helps Codex and other AI agents understand how your app stores and interacts with data.

---

## 🔹 Top-Level Collections

### `/users/{userId}`
- Contains user profile info.
- Fields:
  - `displayName: string`
  - `email: string`
  - `joinedAt: Timestamp`
  - `lastLogin: Timestamp`
  - `plantRefs: string[]`  // array of `plantId` references
  - `hasAcceptedTOS: boolean`
  - `profileImage: string | null`  // URL to profile photo or null

#### `/users/{userId}/settings/preferences`
- Stores user preferences in a single document named “preferences.”
- Fields:
  - `defaultEnvironment: string`  // e.g. “indoor” or “outdoor”
  - `preferredUnits: string`  // “metric” or “imperial”
  - `darkMode: boolean`
  - `defaultReminderTime: string`  // e.g. “08:00”
  - `notificationPreferences: {`
    - `wateringReminders: boolean`
    - `newLogActivity: boolean`
    - `tips: boolean`
  - `}`

### `/plants/{plantId}`
- Main plant document that can be shared by multiple users.
- Fields:
  - `owners: string[]`  // array of `userId`s
  - `name: string`
  - `strain: string`
  - `growthStage: string`  // e.g. “germination”, “seedling”, etc.
  - `ageDays?: number`  // current age of the plant in days
  - `status: string`  // e.g. “active” or “archived”
  - `environment: string`  // “indoor” or “outdoor”
  - `plantedIn: string`  // e.g. “pot”, “ground”
  - `sensorProfileId?: string` // reference to a sensor profile (see /sensorProfiles)
  - **Optional Fields:**
    - `potSize?: string`  // e.g. “20L”
    - `wateringFrequency?: string`  // e.g. “every 2 days”
    - `fertilizer?: string`  // e.g. “BioGrow”
    - `sunlightExposure?: string`  // e.g. “Full sun”
    - `trainingTags?: string[]`  // e.g. [“LST”]
    - `pests?: string[]`  // e.g. [“aphids”]
    - `notes?: string`
    - `imageUri?: string | null`  // primary image URL or null
    - `location?: { lat: number; lng: number }`
    - `locationNickname?: string`  // e.g. “Backyard”
    - `reminderSchedule?: {`
      - `type: string`  // “interval” or “cron”
      - `intervalDays?: number`  // if type == “interval”
      - `timeOfDay?: string`  // e.g. “08:00”
      - `cronExpression?: string`  // if type == “cron”
    - `}`
    - `waterLevel?: number` // current water level (if tracked)
  - **Timestamps:**
    - `createdAt: Timestamp`
    - `updatedAt: Timestamp`

### `/plants/{plantId}/logs/{logId}`
- Subcollection for recording plant events.
- Each document in `logs` has:
  - `timestamp: Timestamp`
  - `type: string`  // e.g. “watering”, “note”, “fertilizing”, “training”
  - `description: string`
  - `updatedBy: string`  // `userId` of the user who created this log
  - `mediaUri?: string`  // optional image or video
  - `value?: number`  // e.g. amount watered, etc.

### `/plants/{plantId}/weatherCache/{YYYY-MM-DD}`
- Subcollection for daily weather data (per plant, per date).
- Fields:
  - `date`: string ("YYYY-MM-DD")
  - `fetchedAt`: Timestamp
  - `forecasted`: boolean
  - `source`: string (e.g. "OpenWeatherMap")
  - `temperature`: number (°C)
  - `humidity`: number (percent)
  - `windSpeed`: number (km/h)
  - `rainfall`: number (mm)
  - `uvIndex`: number
  - `weatherSummary`: string
  - `hourlySummary` (optional): { peakTemp: number, rainHours: number }
  - `dewPoint` (optional): number
  - `cloudCoverage` (optional): number
  - `windGust` (optional): number
  - `sunrise` (optional): string
  - `sunset` (optional): string
  - `pop` (optional): number // Probability of precipitation
  - `detailedTemps` (optional): {
      morn: number;
      day: number;
      eve: number;
      night: number;
      min: number;
      max: number;
    }

### `/plants/{plantId}/progressPics/{picId}`
- Subcollection for storing progress pictures of each plant.
- Each document (identified by `picId`) contains:
  - `imageUrl: string`  // download URL from Firebase Storage
  - `timestamp: Timestamp`  // when the picture was uploaded
  - `caption?: string`  // optional caption or note

### `/groups/{groupId}`
- Represents a group of plants (e.g. a grow tent, room, or outdoor patch).
- Fields:
  - `name: string`
  - `ownerId: string` // userId of group creator
  - `memberIds: string[]` // userIds with access
  - `plantIds: string[]` // plants in this group
  - `createdAt: Timestamp`
  - `updatedAt: Timestamp`
  - `notes?: string`

### `/sensorProfiles/{sensorProfileId}`
- Stores reusable sensor/environmental profiles for plants or groups.
- Fields:
  - `name: string`
  - `ownerId: string` // userId of creator
  - `targetTemperature: { min: number; max: number }`
  - `targetHumidity: { min: number; max: number }`
  - `targetLightHours: number`
  - `targetSoilMoisture?: { min: number; max: number }`
  - `notes?: string`
  - `createdAt: Timestamp`
  - `updatedAt: Timestamp`

### `/notifications/{userId}`
- Stores push notification tokens and topics.
- Fields:
  - `tokens: string[]` // FCM tokens
  - `topics: string[]` // notification topics

### `/analytics/{userId}_year_{year}`
- Aggregated statistics per user for each year.
- Fields:
  - `year: number`
  - `plantCount: number`
  - `logCount: number`
  - `activeDays: number`
  - `lastActive: Timestamp`

### `/invites/{inviteId}`
- Stores plant collaboration invites.
- Fields:
  - `invitedBy: string` // userId
  - `invitedUserEmail: string`
  - `plantId: string`
  - `status: string` // e.g. "pending", "accepted", "declined"
  - `createdAt: Timestamp`

---

## 🔹 Queries and Usage Patterns

### Get all plants owned by a user:
```ts
query(collection(db, "plants"), where("owners", "array-contains", userId))
```

### Get logs for a specific plant:
```ts
collection(db, `plants/${plantId}/logs`)
```

### Get user preferences:
```ts
doc(db, `users/${userId}/settings/preferences`)
```

### Get all groups for a user:
```ts
query(collection(db, "groups"), where("memberIds", "array-contains", userId))
```

### Get all plants in a group:
```ts
// Fetch group, then use group.plantIds to query plants
const group = await getDoc(doc(db, "groups", groupId));
const plantIds = group.data().plantIds;
// Query plants by IDs
```

### Get all sensor profiles for a user:
```ts
query(collection(db, "sensorProfiles"), where("ownerId", "==", userId))
```

---

## 🔹 Related Types
See `firestoreModels.ts` for full TypeScript interfaces for:
- `Plant`
- `PlantLog`
- `UserSettings`
- `WeatherCacheEntry`
- `ProgressPic`
- `Group`
- `SensorProfile`
- `NotificationProfile`
- `UserAnalytics`
- `Invite`

---

## 🔹 Notes & Best Practices
- All timestamps are Firestore `Timestamp` objects unless otherwise noted.
- Use array-contains queries for multi-user and group membership.
- Use subcollections for logs, weather, and progress pictures to keep plant documents lean.
- Use references (IDs) to link between collections (e.g., `sensorProfileId`, `plantIds`).
- See `firestoreModels.ts` for up-to-date field types and usage.
- The schema is designed for scalability, real-time collaboration, and efficient querying.

---

This schema is designed to be scalable, efficient, and collaborative — ideal for a grow tracking app with real-time data and multiple users per plant.
