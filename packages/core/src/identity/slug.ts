/** Lowercase ASCII slug of one path segment: accents removed, any other run of characters becomes one `-`. */
export function slugify(segment: string): string {
  return segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
