/**
 * A name for a segment with no ASCII letter or digit (a title in another script, an emoji,
 * dashes alone): `u` and the eight hex digits of the FNV-1a hash of the segment, the same on
 * every build and never empty, so that the identifier and the address of the note stay valid.
 */
function fallbackSlug(segment: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < segment.length; index += 1) {
    hash ^= segment.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `u${hash.toString(16).padStart(8, "0")}`;
}

/** Lowercase ASCII slug of one path segment: accents removed, any other run of characters becomes one `-`; a hashed name when nothing is left. */
export function slugify(segment: string): string {
  const slug = segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    // The collapse above leaves no two dashes together, so a dash at either end stands alone.
    .replace(/^-|-$/g, "");
  return slug === "" ? fallbackSlug(segment) : slug;
}
