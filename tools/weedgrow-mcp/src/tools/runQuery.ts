import { z } from "zod";
import admin from "firebase-admin";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFirestore } from "../firebase.js";
import type {
  FirestoreQueryInput,
  FirestoreValue,
  OrderDirection,
  SpecialValue,
  WhereOp,
} from "../types.js";

const whereSchema = z
  .object({
    fieldPath: z.string().trim().min(1),
    op: z.enum([
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
      "array-contains",
      "in",
      "array-contains-any",
    ]),
    value: z.any(),
  })
  .strict();

const orderBySchema = z
  .object({
    fieldPath: z.string().trim().min(1),
    direction: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

const inputSchema = z
  .object({
    collection: z.string().trim().min(1),
    where: z.array(whereSchema).optional(),
    orderBy: z.array(orderBySchema).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    select: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

function isSpecialValue(value: unknown): value is SpecialValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "__type" in value &&
    typeof (value as { __type?: string }).__type === "string"
  );
}

function normalizeValue(value: unknown): unknown {
  if (!isSpecialValue(value)) {
    return value;
  }

  switch (value.__type) {
    case "timestamp": {
      if (value.iso) {
        const date = new Date(value.iso);
        if (Number.isNaN(date.getTime())) {
          throw new Error(`Invalid timestamp iso string: ${value.iso}`);
        }
        return admin.firestore.Timestamp.fromDate(date);
      }
      if (typeof value.seconds === "number") {
        return new admin.firestore.Timestamp(
          value.seconds,
          value.nanoseconds ?? 0
        );
      }
      throw new Error("Timestamp value requires iso or seconds.");
    }
    case "geoPoint": {
      if (typeof value.lat !== "number" || typeof value.lng !== "number") {
        throw new Error("GeoPoint value requires lat and lng numbers.");
      }
      return new admin.firestore.GeoPoint(value.lat, value.lng);
    }
    case "reference": {
      if (!value.path || typeof value.path !== "string") {
        throw new Error("Reference value requires a path string.");
      }
      const db = getFirestore();
      return db.doc(value.path);
    }
    case "bytes": {
      if (!value.base64 || typeof value.base64 !== "string") {
        throw new Error("Bytes value requires base64 string.");
      }
      return Buffer.from(value.base64, "base64");
    }
    default:
      return value;
  }
}

function validateWhereClause(op: WhereOp, value: unknown) {
  if (value === undefined) {
    throw new Error("where.value cannot be undefined.");
  }

  if (op === "in" || op === "array-contains-any") {
    if (!Array.isArray(value)) {
      throw new Error(`${op} requires an array value.`);
    }
    if (value.length === 0) {
      throw new Error(`${op} requires a non-empty array.`);
    }
    if (value.length > 10) {
      throw new Error(`${op} supports up to 10 values.`);
    }
  }

  if (op === "array-contains" && Array.isArray(value)) {
    throw new Error("array-contains requires a single non-array value.");
  }
}

function serializeValue(value: unknown): FirestoreValue {
  if (value === null) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return {
      __type: "timestamp",
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (value instanceof admin.firestore.GeoPoint) {
    return {
      __type: "geoPoint",
      lat: value.latitude,
      lng: value.longitude,
    };
  }

  if (value instanceof admin.firestore.DocumentReference) {
    return {
      __type: "reference",
      path: value.path,
    };
  }

  if (value instanceof Buffer || value instanceof Uint8Array) {
    return {
      __type: "bytes",
      base64: Buffer.from(value).toString("base64"),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item)) as FirestoreValue;
  }

  if (typeof value === "object") {
    const output: Record<string, FirestoreValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = serializeValue(item);
    }
    return output;
  }

  return value as FirestoreValue;
}

export function registerRunQuery(server: McpServer) {
  server.tool(
    "runQuery",
    "Run a safe Firestore query against the emulator.",
    inputSchema.shape,
    async (input) => {
      const parsed = inputSchema.parse(input ?? {});
      const queryInput: FirestoreQueryInput = {
        collection: parsed.collection,
        where: parsed.where?.map(clause => ({ ...clause, value: clause.value as FirestoreValue })),
        orderBy: parsed.orderBy,
        limit: parsed.limit,
        select: parsed.select,
      };

      const db = getFirestore();
      let query: FirebaseFirestore.Query = db.collection(queryInput.collection);

      if (queryInput.where) {
        for (const clause of queryInput.where) {
          validateWhereClause(clause.op as WhereOp, clause.value);
          const normalizedValue = normalizeValue(clause.value);
          query = query.where(clause.fieldPath, clause.op as WhereOp, normalizedValue);
        }
      }

      if (queryInput.orderBy) {
        for (const order of queryInput.orderBy) {
          query = query.orderBy(
            order.fieldPath,
            (order.direction || "asc") as OrderDirection
          );
        }
      }

      if (queryInput.select && queryInput.select.length > 0) {
        const fields = queryInput.select.map((fieldPath) => {
          if (fieldPath === "__name__") {
            return admin.firestore.FieldPath.documentId();
          }
          return fieldPath;
        });
        query = query.select(...fields);
      }

      const limit = queryInput.limit ?? 50;
      query = query.limit(limit);

      const snapshot = await query.get();
      const documents = snapshot.docs.map((doc) => ({
        id: doc.id,
        path: doc.ref.path,
        data: serializeValue(doc.data()),
      }));

      const result = {
        count: documents.length,
        documents,
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
