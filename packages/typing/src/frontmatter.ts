/** A frontmatter scalar as the cascades read it: a string as written, anything else serialised so that findings show it. */
export function declaredString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}
