import admin from "firebase-admin";
import { getFirestore } from "./firebase.js";
import { loadEnv } from "./env.js";

function logInfo(message: string) {
  console.log(`[weedgrow-mcp] ${message}`);
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400000);
}

async function seed() {
  loadEnv();
  const db = getFirestore();
  const now = admin.firestore.Timestamp.now();
  const profile = (process.env.WEEDGROW_SEED_PROFILE || "full").toLowerCase();
  const isLite = profile === "lite" || profile === "minimal";

  const userId = "demo_user_zane";
  const friendId = "demo_user_friend";
  const plantAId = "plant_demo_northern_lights";
  const plantBId = "plant_demo_amnesia_haze";
  const groupId = "group_demo_main_tent";
  const sensorProfileId = "sensor_demo_tent";

  const batch = db.batch();

  batch.set(db.collection("users").doc(userId), {
    displayName: "Zane G",
    email: "zane@example.com",
    joinedAt: now,
    lastLogin: now,
    plantRefs: isLite ? [plantAId] : [plantAId, plantBId],
    hasAcceptedTOS: true,
    profileImage: null,
  });

  batch.set(db.collection("users").doc(friendId), {
    displayName: "Guest Grower",
    email: "friend@example.com",
    joinedAt: now,
    lastLogin: now,
    plantRefs: [plantBId],
    hasAcceptedTOS: true,
    profileImage: null,
  });

  batch.set(
    db.collection("users").doc(userId).collection("settings").doc("preferences"),
    {
      defaultEnvironment: "indoor",
      preferredUnits: "metric",
      darkMode: true,
      defaultReminderTime: "08:00",
      notificationPreferences: {
        wateringReminders: true,
        newLogActivity: true,
        tips: true,
      },
    }
  );

  batch.set(
    db.collection("users").doc(friendId).collection("settings").doc("preferences"),
    {
      defaultEnvironment: "outdoor",
      preferredUnits: "metric",
      darkMode: false,
      defaultReminderTime: "07:30",
      notificationPreferences: {
        wateringReminders: false,
        newLogActivity: true,
        tips: false,
      },
    }
  );

  batch.set(db.collection("sensorProfiles").doc(sensorProfileId), {
    name: "Main Tent",
    ownerId: userId,
    targetTemperature: { min: 22, max: 27 },
    targetHumidity: { min: 50, max: 65 },
    targetLightHours: 18,
    targetSoilMoisture: { min: 35, max: 55 },
    notes: "Veg profile",
    createdAt: now,
    updatedAt: now,
  });

  batch.set(db.collection("plants").doc(plantAId), {
    name: "Northern Lights",
    strain: "Indica",
    owners: [userId],
    growthStage: "vegetative",
    ageDays: 50,
    status: "active",
    environment: "indoor",
    plantedIn: "pot",
    potSize: "20L",
    sunlightExposure: "Full sun",
    wateringFrequency: "every 2 days",
    fertilizer: "BioGrow",
    pests: ["aphids"],
    trainingTags: ["LST", "Topping"],
    notes: "Responding well to training.",
    imageUri: "https://example.com/images/northern-lights.jpg",
    waterLevel: 0.65,
    location: { lat: -34.0555, lng: 18.457 },
    locationNickname: "Backyard",
    sensorProfileId: sensorProfileId,
    reminderSchedule: {
      type: "interval",
      intervalDays: 2,
      timeOfDay: "08:00",
    },
    createdAt: now,
    updatedAt: now,
  });

  batch.set(db.collection("plants").doc(plantBId), {
    name: "Amnesia Haze",
    strain: "Sativa",
    owners: [userId, friendId],
    growthStage: "flowering",
    ageDays: 90,
    status: "active",
    environment: "outdoor",
    plantedIn: "ground",
    potSize: "",
    sunlightExposure: "Full sun",
    wateringFrequency: "every 3 days",
    fertilizer: "BloomX",
    pests: [],
    trainingTags: ["LST"],
    notes: "Stretching phase, watch humidity.",
    imageUri: "https://example.com/images/amnesia-haze.jpg",
    waterLevel: 0.45,
    location: { lat: -34.0569, lng: 18.459 },
    locationNickname: "Garden Patch",
    reminderSchedule: {
      type: "custom",
      customDays: ["Mon", "Thu"],
      timeOfDay: "07:30",
    },
    createdAt: now,
    updatedAt: now,
  });

  if (!isLite) {
    batch.set(db.collection("groups").doc(groupId), {
      name: "Main Tent",
      environment: "indoor",
      plantIds: [plantAId, plantBId],
      location: { lat: -34.0555, lng: 18.457 },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      sensorProfileId: sensorProfileId,
      weatherSourcePlantId: plantAId,
    });

    batch.set(db.collection("notifications").doc(userId), {
      deviceTokens: ["demoToken1", "demoToken2"],
      subscribedTopics: ["watering", "growthTips"],
      lastUpdated: now,
    });

    batch.set(db.collection("analytics").doc(`${userId}_year_2025`), {
      year: 2025,
      totalWaterings: 12,
      totalFertilizations: 4,
      completedStages: {
        germination: 1,
        seedling: 1,
        vegetative: 1,
        flowering: 0,
      },
      pestsEncountered: ["aphids"],
      mostUsedTrainingTags: ["LST", "Topping"],
      totalPlantsCreated: 2,
      totalPlantsArchived: 0,
    });

    batch.set(db.collection("invites").doc("invite_demo_1"), {
      invitedBy: userId,
      invitedUserEmail: "friend@example.com",
      plantId: plantBId,
      status: "pending",
      createdAt: now,
    });
  }

  await batch.commit();

  const plantALogs = db.collection("plants").doc(plantAId).collection("logs");
  const plantBLogs = db.collection("plants").doc(plantBId).collection("logs");

  await Promise.all([
    plantALogs.doc("log_watering_1").set({
      timestamp: now,
      type: "watering",
      description: "Gave 600ml of water",
      updatedBy: userId,
    }),
    plantALogs.doc("log_training_1").set({
      timestamp: now,
      type: "training",
      description: "LST and topped main cola",
      updatedBy: userId,
    }),
    plantBLogs.doc("log_fertilizing_1").set({
      timestamp: now,
      type: "fertilizing",
      description: "Bloom feed 5ml/L",
      updatedBy: userId,
    }),
    plantBLogs.doc("log_note_1").set({
      timestamp: now,
      type: "note",
      description: "Humidity spikes after sunset",
      updatedBy: friendId,
    }),
  ]);

  const weatherA = db.collection("plants").doc(plantAId).collection("weatherCache");
  const weatherB = db.collection("plants").doc(plantBId).collection("weatherCache");

  const yesterday = daysFromNow(-1);
  const today = daysFromNow(0);
  const tomorrow = daysFromNow(1);

  await Promise.all([
    weatherA.doc(dateString(yesterday)).set({
      date: dateString(yesterday),
      fetchedAt: now,
      forecasted: false,
      source: "OpenWeatherMap",
      temperature: 20,
      humidity: 55,
      windSpeed: 8,
      rainfall: 1,
      uvIndex: 4,
      weatherSummary: "Partly cloudy",
      hourlySummary: { peakTemp: 21, rainHours: 1 },
      dewPoint: 12,
      cloudCoverage: 40,
      windGust: 12,
      sunrise: "06:10",
      sunset: "18:30",
      pop: 0.2,
      detailedTemps: {
        morn: 16.4,
        day: 18.5,
        eve: 18.0,
        night: 17.1,
        min: 15.2,
        max: 22.8,
      },
    }),
    weatherA.doc(dateString(today)).set({
      date: dateString(today),
      fetchedAt: now,
      forecasted: false,
      source: "OpenWeatherMap",
      temperature: 22,
      humidity: 60,
      windSpeed: 10,
      rainfall: 0,
      uvIndex: 6,
      weatherSummary: "Sunny and warm",
      hourlySummary: { peakTemp: 23, rainHours: 0 },
      dewPoint: 13,
      cloudCoverage: 20,
      windGust: 15,
      sunrise: "06:15",
      sunset: "18:35",
      pop: 0.1,
    }),
    weatherB.doc(dateString(today)).set({
      date: dateString(today),
      fetchedAt: now,
      forecasted: false,
      source: "OpenWeatherMap",
      temperature: 25,
      humidity: 45,
      windSpeed: 12,
      rainfall: 0,
      uvIndex: 7,
      weatherSummary: "Clear sky",
      hourlySummary: { peakTemp: 26, rainHours: 0 },
      dewPoint: 14,
      cloudCoverage: 5,
      windGust: 10,
      sunrise: "06:12",
      sunset: "18:38",
      pop: 0.0,
    }),
    weatherB.doc(dateString(tomorrow)).set({
      date: dateString(tomorrow),
      fetchedAt: now,
      forecasted: true,
      source: "OpenWeatherMap",
      temperature: 19,
      humidity: 70,
      windSpeed: 15,
      rainfall: 5,
      uvIndex: 3,
      weatherSummary: "Expected showers",
      hourlySummary: { peakTemp: 20, rainHours: 3 },
      dewPoint: 11,
      cloudCoverage: 80,
      windGust: 30,
      sunrise: "06:20",
      sunset: "18:40",
      pop: 0.7,
      detailedTemps: {
        morn: 15.0,
        day: 17.2,
        eve: 16.5,
        night: 14.8,
        min: 13.9,
        max: 19.7,
      },
    }),
  ]);

  const progressA = db.collection("plants").doc(plantAId).collection("progressPics");
  const progressB = db.collection("plants").doc(plantBId).collection("progressPics");

  await Promise.all([
    progressA.doc("pic_day1").set({
      imageUrl: "https://example.com/images/progress/nl_day1.jpg",
      timestamp: now,
      caption: "Day 1 - just sprouted",
    }),
    progressA.doc("pic_day10").set({
      imageUrl: "https://example.com/images/progress/nl_day10.jpg",
      timestamp: now,
      caption: "Day 10 - strong growth",
    }),
    progressB.doc("pic_day30").set({
      imageUrl: "https://example.com/images/progress/ah_day30.jpg",
      timestamp: now,
      caption: "Day 30 - early stretch",
    }),
  ]);

  logInfo(`Seeded Firestore emulator with profile=${profile}`);
}

seed().catch((error) => {
  console.error("[weedgrow-mcp] Seed failed:", error);
  process.exit(1);
});
