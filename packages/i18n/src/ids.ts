import { AREAS } from "./areas.js";

type UnionToIntersection<Union> = (
  Union extends unknown ? (member: Union) => void : never
) extends (member: infer Intersection) => void
  ? Intersection
  : never;

type Areas = (typeof AREAS)[number];

/** The source catalogue, every area merged: its keys are the identifiers. */
type Source = UnionToIntersection<Areas["en"]>;

/** Every identifier of the source catalogue; an unknown identifier does not compile. */
export type MessageId = keyof Source;

/** One flat record from the records of every area, in the order of the areas. */
function merged<Value>(
  records: readonly Readonly<Record<string, Value>>[],
): Readonly<Record<string, Value>> {
  const record: Record<string, Value> = {};
  for (const part of records) Object.assign(record, part);
  return record;
}

// Every area lists its own identifiers, so the merge of them all lists every identifier.
export const source = merged(AREAS.map((area) => area.en)) as Source;

// The same identifiers, translated: an area declares its French next to its English.
export const french = merged(AREAS.map((area) => area.fr)) as UnionToIntersection<Areas["fr"]>;

/** The ICU kind of every argument of every message, as declared by the areas. */
export const messageArguments = merged(
  AREAS.map((area) => area.arguments),
  // Each area declares the arguments of its own identifiers, so the merge covers them all.
) as UnionToIntersection<Areas["arguments"]>;

type Declared = typeof messageArguments;

/** The identifiers whose declaration lists at least one argument. */
type WithArguments = {
  [Id in MessageId]: keyof Declared[Id] extends never ? never : Id;
}[MessageId];

/** The TypeScript type a value must have for each ICU kind. */
export interface ArgumentValues {
  argument: string;
  number: number;
  date: Date;
  time: Date;
  select: string;
  plural: number;
  tag: never;
}

/**
 * The arguments of the messages that take some, typed from the kinds the areas declare; a
 * message absent from this type takes none.
 */
export type MessageArguments = {
  [Id in WithArguments]: {
    -readonly [Name in keyof Declared[Id]]: Declared[Id][Name] extends keyof ArgumentValues
      ? ArgumentValues[Declared[Id][Name]]
      : never;
  };
};

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/** The identifiers of the source catalogue in sorted order. */
export const messageIds: readonly MessageId[] = Object.keys(source)
  .sort(byCodeUnit)
  // Object.keys returns the keys of the merged catalogue, whose type lists exactly them.
  .map((id) => id as MessageId);

/** A record with one value per identifier of the source catalogue. */
export function byMessageId<T>(value: (id: MessageId) => T): Readonly<Record<MessageId, T>> {
  const record: Partial<Record<MessageId, T>> = {};
  for (const id of messageIds) record[id] = value(id);
  // Every identifier received a value in the loop above.
  return record as Record<MessageId, T>;
}

/** The argument names of every message in sorted order, for checks against the parsed catalogues. */
export const argumentNames: Readonly<Record<MessageId, readonly string[]>> = byMessageId((id) =>
  Object.keys(messageArguments[id]).sort(byCodeUnit),
);
