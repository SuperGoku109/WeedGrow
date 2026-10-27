import admin from "firebase-admin";
import { loadEnv } from "./env.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type EmulatorHost = {
  raw: string;
  host: string;
  port: number;
};

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;
let didLogConfig = false;

function logInfo(message: string) {
  console.log(`[weedgrow-mcp] ${message}`);
}

function logWarn(message: string) {
  console.warn(`[weedgrow-mcp][warn] ${message}`);
}

export function assertFirestoreEmulatorHost(): EmulatorHost {
  loadEnv();
  const raw = process.env.FIRESTORE_EMULATOR_HOST;
  if (!raw) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is required and must be set to something like 127.0.0.1:8080 (no protocol)."
    );
  }
  if (raw.includes("http://") || raw.includes("https://")) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must not include http:// or https://. Use 127.0.0.1:8080 instead."
    );
  }
  const [host, portString, ...rest] = raw.split(":");
  if (!host || !portString || rest.length > 0) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST must be in host:port format. Received: ${raw}`
    );
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to connect to non-local Firestore emulator host: ${host}. Use localhost or 127.0.0.1.`
    );
  }
  const port = Number(portString);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST port must be a valid number. Received: ${portString}`
    );
  }
  return { raw, host, port };
}

function resolveProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.PROJECT_ID ||
    "weedgrow-local"
  );
}

export function getFirestore(): admin.firestore.Firestore {
  const emulator = assertFirestoreEmulatorHost();

  if (!app) {
    const projectId = resolveProjectId();
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }

    app = admin.initializeApp({ projectId });
    logInfo(`Initialized firebase-admin with projectId=${projectId}`);

    db = app.firestore();
    db.settings({ host: emulator.raw, ssl: false });

    if (!didLogConfig) {
      logInfo(
        `Firestore emulator configured via FIRESTORE_EMULATOR_HOST=${emulator.raw}`
      );
      didLogConfig = true;
    }
  }

  if (!db) {
    db = app.firestore();
  }

  return db;
}

export function warnIfAuthEmulatorMissing() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    logWarn(
      "FIREBASE_AUTH_EMULATOR_HOST is not set. This is only required if you use the Auth emulator."
    );
  }
}
