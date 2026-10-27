import { z } from "zod";
import admin from "firebase-admin";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFirestore } from "../firebase.js";

const inputSchema = z
  .object({
    collection: z.string().trim().min(1),
    sample: z.number().int().min(1).max(200).optional(),
  })
  .strict();

type FieldStats = {
  countPresent: number;
  typeCounts: Map<string, number>;
  enumCounts: Map<string, number>;
  arrayElementTypeCounts: Map<string, number>;
};

function getTypeName(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof admin.firestore.Timestamp) return "timestamp";
  if (value instanceof admin.firestore.GeoPoint) return "geoPoint";
  if (value instanceof admin.firestore.DocumentReference) return "reference";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "map";
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof admin.firestore.Timestamp) &&
    !(value instanceof admin.firestore.GeoPoint) &&
    !(value instanceof admin.firestore.DocumentReference)
  );
}

function ensureFieldStats(map: Map<string, FieldStats>, fieldPath: string) {
  if (!map.has(fieldPath)) {
    map.set(fieldPath, {
      countPresent: 0,
      typeCounts: new Map(),
      enumCounts: new Map(),
      arrayElementTypeCounts: new Map(),
    });
  }
  return map.get(fieldPath)!;
}

function recordType(stats: FieldStats, typeName: string) {
  stats.typeCounts.set(typeName, (stats.typeCounts.get(typeName) || 0) + 1);
}

function recordEnumValue(stats: FieldStats, value: string) {
  stats.enumCounts.set(value, (stats.enumCounts.get(value) || 0) + 1);
}

function recordArrayElement(stats: FieldStats, typeName: string) {
  stats.arrayElementTypeCounts.set(
    typeName,
    (stats.arrayElementTypeCounts.get(typeName) || 0) + 1
  );
}

function analyzeValue(
  map: Map<string, FieldStats>,
  fieldPath: string,
  value: unknown,
  presentPaths: Set<string>
) {
  const stats = ensureFieldStats(map, fieldPath);
  if (!presentPaths.has(fieldPath)) {
    stats.countPresent += 1;
    presentPaths.add(fieldPath);
  }

  const typeName = getTypeName(value);
  recordType(stats, typeName);

  if (typeName === "string") {
    recordEnumValue(stats, value as string);
  }

  if (typeName === "array") {
    const arr = value as unknown[];
    for (const element of arr) {
      const elementType = getTypeName(element);
      recordArrayElement(stats, elementType);

      if (isPlainObject(element)) {
        for (const [key, nestedValue] of Object.entries(element)) {
          analyzeValue(map, `${fieldPath}[].${key}`, nestedValue, presentPaths);
        }
      }
    }
  }

  if (isPlainObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      analyzeValue(map, `${fieldPath}.${key}`, nestedValue, presentPaths);
    }
  }
}

export function registerDescribeCollection(server: McpServer) {
  server.tool(
    "describeCollection",
    "Sample documents from a collection and infer field paths and types.",
    inputSchema.shape,
    async (input) => {
      const parsed = inputSchema.parse(input ?? {});
      const db = getFirestore();
      const sample = parsed.sample ?? 50;

      const snapshot = await db
        .collection(parsed.collection)
        .limit(sample)
        .get();

      const fieldMap = new Map<string, FieldStats>();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const presentPaths = new Set<string>();
        for (const [key, value] of Object.entries(data)) {
          analyzeValue(fieldMap, key, value, presentPaths);
        }
      }

      const fields: Record<
        string,
        {
          types: string[];
          presencePct: number;
          enumValues?: { value: string; count: number }[];
          arrayElementTypes?: string[];
        }
      > = {};

      for (const [fieldPath, stats] of fieldMap.entries()) {
        const types = Array.from(stats.typeCounts.keys()).sort();
        const presencePct = snapshot.size
          ? Math.round((stats.countPresent / snapshot.size) * 1000) / 10
          : 0;

        const enumValues: { value: string; count: number }[] = [];
        if (stats.enumCounts.size > 0 && stats.enumCounts.size <= 10) {
          for (const [value, count] of stats.enumCounts.entries()) {
            enumValues.push({ value, count });
          }
          enumValues.sort((a, b) => b.count - a.count);
        }

        const arrayElementTypes = Array.from(
          stats.arrayElementTypeCounts.keys()
        ).sort();

        fields[fieldPath] = {
          types,
          presencePct,
          ...(enumValues.length > 0 ? { enumValues } : {}),
          ...(arrayElementTypes.length > 0 ? { arrayElementTypes } : {}),
        };
      }

      const result = {
        collection: parsed.collection,
        sampleRequested: sample,
        sampleCount: snapshot.size,
        fields,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }
  );
}
