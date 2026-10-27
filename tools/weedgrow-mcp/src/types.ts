export type WhereOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "in"
  | "array-contains-any";

export type OrderDirection = "asc" | "desc";

export type TimestampValue = {
  __type: "timestamp";
  iso?: string;
  seconds?: number;
  nanoseconds?: number;
};

export type GeoPointValue = {
  __type: "geoPoint";
  lat: number;
  lng: number;
};

export type ReferenceValue = {
  __type: "reference";
  path: string;
};

export type BytesValue = {
  __type: "bytes";
  base64: string;
};

export type SpecialValue = TimestampValue | GeoPointValue | ReferenceValue | BytesValue;

export type FirestoreValue =
  | string
  | number
  | boolean
  | null
  | FirestoreValue[]
  | { [key: string]: FirestoreValue }
  | SpecialValue;

export interface WhereClause {
  fieldPath: string;
  op: WhereOp;
  value: FirestoreValue;
}

export interface OrderByClause {
  fieldPath: string;
  direction?: OrderDirection;
}

export interface FirestoreQueryInput {
  collection: string;
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  select?: string[];
}

export interface QueryResultDocument {
  id: string;
  path: string;
  data: FirestoreValue;
}

export interface QueryResult {
  count: number;
  documents: QueryResultDocument[];
}

export interface DescribeCollectionResult {
  collection: string;
  sampleRequested: number;
  sampleCount: number;
  fields: Record<
    string,
    {
      types: string[];
      presencePct: number;
      enumValues?: { value: string; count: number }[];
      arrayElementTypes?: string[];
    }
  >;
}