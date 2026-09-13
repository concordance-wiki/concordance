/** An object a contract names that has no note yet; offered to the author, never linked automatically. */
export interface CandidateObject {
  kind: "object";
  /** The schema or type name as the contract writes it. */
  name: string;
  /** Identifier of the API whose contract names the object. */
  from: string;
  /** The contract location as written in the API note. */
  contract: string;
}

/** A contract read by a source: what it declared about itself and when it was imported. */
export interface ContractRecord {
  /** Identifier of the API note that declares the contract. */
  api: string;
  /** The contract location as written in the API note. */
  location: string;
  title: string;
  /** The version the contract declares, empty when it declares none. */
  version: string;
  /** The format of the contract as the reader names it, with its version: `openapi 3.1`, `wsdl 1.1`. */
  format: string;
  /** Hex SHA-256 of the contract bytes, the key of the contract cache. */
  fingerprint: string;
  /** ISO 8601 date of the import, from the injected clock. */
  imported_at: string;
}

/** One field of a schema, as the contract viewer lists it. */
export interface ContractField {
  name: string;
  /** The type as the format writes it, or the name of the schema it references. */
  type: string;
  required: boolean;
  description?: string;
}

/** A schema or type a contract declares, reduced to what a reader of the note needs. */
export interface ContractSchema {
  name: string;
  description?: string;
  /** The type of a schema that is not an object: an enumeration, an alias of a primitive, an array. */
  type?: string;
  /** In declaration order; empty for a schema without properties. */
  fields: ContractField[];
}

function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** Canonical order of contract records: by API identifier, then by location. */
export function compareContracts(a: ContractRecord, b: ContractRecord): number {
  return byCodeUnit(a.api, b.api) || byCodeUnit(a.location, b.location);
}
