/**
 * Every string of a value passed through `substitute`, the strings of nested lists and records
 * included; numbers, booleans and nulls are kept as they are. What the metadata of a reader or
 * the attributes of an entity hold is replaced the same way as a text.
 */
export function substituteStrings(value: unknown, substitute: (text: string) => string): unknown {
  if (typeof value === "string") return substitute(value);
  if (Array.isArray(value))
    return value.map((item: unknown) => substituteStrings(item, substitute));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substituteStrings(item, substitute)]),
    );
  }
  return value;
}
