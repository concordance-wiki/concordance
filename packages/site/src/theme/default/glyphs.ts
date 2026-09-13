/**
 * The simple shapes the map can draw inside a node, each a path in a 10 by 10 box. The set is
 * the theme's: another theme ships its own sprite.
 */
export const GLYPH_SHAPES = {
  rectangle: "M1 2h8v6H1z",
  hexagon: "M5 .5 9.5 3v4L5 9.5.5 7V3z",
  shield: "M5 .5 9.5 2.5v3c0 2-2 3.5-4.5 4.3C2.5 9 .5 7.5.5 5.5v-3z",
  book: "M1 1.5h3.5v7H1zm4.5 0H9v7H5.5z",
  page: "M2 .5h4.5l2 2v7H2z",
  diamond: "M5 .5 9.5 5 5 9.5.5 5z",
  arrow: "M.5 3.5h5V1L9.5 5 5.5 9V6.5h-5z",
  triangle: "M5 .5 9.5 9.5H.5z",
} as const;

export type GlyphShape = keyof typeof GLYPH_SHAPES;

/**
 * Which shape stands for which glyph name of the profile. The keys are glyph names, presentation
 * data a profile declares per type (`glyph: screen`), never type slugs: the theme does not know
 * the types, and a glyph name it has no shape for is drawn as its initial.
 */
const SHAPE_OF_GLYPH: Readonly<Record<string, GlyphShape>> = {
  application: "rectangle",
  screen: "rectangle",
  table: "rectangle",
  api: "hexagon",
  endpoint: "hexagon",
  service: "hexagon",
  rule: "shield",
  constraint: "shield",
  principle: "shield",
  standard: "shield",
  term: "book",
  document: "page",
  meeting: "page",
  message: "page",
  object: "diamond",
  item: "diamond",
  package: "diamond",
  decision: "diamond",
  process: "arrow",
  batch: "arrow",
  channel: "arrow",
  event: "arrow",
  goal: "triangle",
  requirement: "triangle",
  milestone: "triangle",
  strategy: "triangle",
};

export function shapeOfGlyph(glyph: string): GlyphShape | undefined {
  // A name such as `constructor` must read the table, not the object prototype.
  return Object.hasOwn(SHAPE_OF_GLYPH, glyph) ? SHAPE_OF_GLYPH[glyph] : undefined;
}

/** The initial of a glyph name, drawn when the theme has no shape for it. */
export function initialOfGlyph(glyph: string): string {
  return glyph.slice(0, 1).toUpperCase();
}
