/** Font size the map is laid out for, written on the `<svg>` so that the estimate and the rendering agree. */
export const FONT_SIZE = 12;
/** Average advance of the interface font as a fraction of the font size; wide enough for Latin text. */
const CHAR_WIDTH = 0.55;
/** A title longer than this is cut with an ellipsis; the full title travels in a `<title>` and in the list. */
export const LABEL_MAX = 28;
export const NODE_RADIUS = 9;
export const CENTRE_RADIUS = 11;
const LINE_HEIGHT = 14;
const MARGIN = 8;
/** Distance from a node centre to the start of its label. */
const LABEL_GAP = NODE_RADIUS + 5;
/** Room above and below the ring for a label at a pole. */
const PAD = LABEL_GAP + LINE_HEIGHT + MARGIN;
const MIN_WIDTH = 320;
/** A node whose angle has a cosine under this sits at a pole: its label goes above or below it. */
const POLE = 0.25;
/** Vertical distance kept between two label boxes the collision pass separates. */
const SEPARATION = 2;

export type LabelSide = "left" | "right" | "above" | "below";
export type TextAnchor = "start" | "middle" | "end";

/** Axis-aligned box in viewBox units, `right` and `bottom` exclusive. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Cut {
  /** What the map writes: the title, cut at `LABEL_MAX` characters with an ellipsis. */
  text: string;
  /** The full title when `text` is cut, for the `<title>` of the label. */
  full?: string;
}

export interface PlacedLabel extends Cut {
  /** Anchor point of the text; the theme centres the line on `y` with `dy="0.35em"`. */
  x: number;
  y: number;
  anchor: TextAnchor;
  side: LabelSide;
  box: Box;
}

export interface PlacedNode {
  x: number;
  y: number;
  label: PlacedLabel;
}

export interface PlacedItem<T> extends PlacedNode {
  item: T;
}

export interface Layout<T> {
  width: number;
  height: number;
  centre: PlacedNode;
  /** In the order received: rank order, clockwise from the top. */
  nodes: PlacedItem<T>[];
}

export function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Whether `inner` lies entirely within `outer`. */
export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  );
}

export function truncate(title: string): Cut {
  const characters = Array.from(title);
  if (characters.length <= LABEL_MAX) return { text: title };
  return { text: `${characters.slice(0, LABEL_MAX - 1).join("")}…`, full: title };
}

/** Estimated advance of a label; an ellipsis counts for two characters, being wider than the average. */
function widthOf(cut: Cut): number {
  const characters = Array.from(cut.text).length + (cut.full === undefined ? 0 : 1);
  return Math.ceil(characters * CHAR_WIDTH * FONT_SIZE);
}

function ringRadius(count: number): number {
  return Math.min(100, Math.max(60, 46 + 6 * count));
}

function sideOf(cosine: number, sine: number): LabelSide {
  if (cosine > POLE) return "right";
  if (cosine < -POLE) return "left";
  return sine < 0 ? "above" : "below";
}

function centred(x: number, y: number, width: number): Box {
  const left = x - Math.ceil(width / 2);
  return { left, top: y - LINE_HEIGHT / 2, right: left + width, bottom: y + LINE_HEIGHT / 2 };
}

/** The label of a node, its box on the outer side of the node. */
function labelOf(node: { x: number; y: number }, side: LabelSide, cut: Cut): PlacedLabel {
  const width = widthOf(cut);
  const half = LINE_HEIGHT / 2;
  switch (side) {
    case "right": {
      const x = node.x + LABEL_GAP;
      const box = { left: x, top: node.y - half, right: x + width, bottom: node.y + half };
      return { ...cut, x, y: node.y, anchor: "start", side, box };
    }
    case "left": {
      const x = node.x - LABEL_GAP;
      const box = { left: x - width, top: node.y - half, right: x, bottom: node.y + half };
      return { ...cut, x, y: node.y, anchor: "end", side, box };
    }
    case "above": {
      const y = node.y - LABEL_GAP - half;
      return { ...cut, x: node.x, y, anchor: "middle", side, box: centred(node.x, y, width) };
    }
    case "below": {
      const y = node.y + LABEL_GAP + half;
      return { ...cut, x: node.x, y, anchor: "middle", side, box: centred(node.x, y, width) };
    }
  }
}

function shift(label: PlacedLabel, dy: number): void {
  label.y += dy;
  label.box = { ...label.box, top: label.box.top + dy, bottom: label.box.bottom + dy };
}

/**
 * Pushes every label below the ones it overlaps, in top-to-bottom order: a label only ever
 * moves down, and each move takes it past one more of the labels placed before it, so the pass
 * ends with no two boxes intersecting.
 */
function separate(labels: readonly PlacedLabel[]): void {
  const ordered = [...labels].sort((a, b) => a.box.top - b.box.top);
  const placed: Box[] = [];
  for (const label of ordered) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of placed) {
        if (intersects(label.box, other)) {
          shift(label, other.bottom + SEPARATION - label.box.top);
          moved = true;
        }
      }
    }
    placed.push(label.box);
  }
}

function translate<N extends PlacedNode>(node: N, dx: number, dy: number): N {
  const { label } = node;
  const { box } = label;
  return {
    ...node,
    x: node.x + dx,
    y: node.y + dy,
    label: {
      ...label,
      x: label.x + dx,
      y: label.y + dy,
      box: {
        left: box.left + dx,
        top: box.top + dy,
        right: box.right + dx,
        bottom: box.bottom + dy,
      },
    },
  };
}

/**
 * Places the centre in the middle and the neighbours on a ring in the order received, clockwise
 * from the top; a label sits on the outer side of its node, right of it on the right half, left
 * of it on the left half, above or below it near the poles, and the centre's title under the
 * centre. Every coordinate is an integer, so that two builds give the same bytes; text widths
 * are estimated at `CHAR_WIDTH` em per character, and on that estimate no two label boxes
 * intersect and every box lies inside the viewBox.
 */
export function layoutNeighbourhood<T>(
  centre: string,
  items: readonly T[],
  titleOf: (item: T) => string,
): Layout<T> {
  const radius = ringRadius(items.length);
  const nodes: PlacedItem<T>[] = items.map((item, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / items.length;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const position = { x: Math.round(radius * cosine), y: Math.round(radius * sine) };
    const label = labelOf(position, sideOf(cosine, sine), truncate(titleOf(item)));
    return { item, ...position, label };
  });
  const centreCut = truncate(centre);
  const centreY = CENTRE_RADIUS + 4 + LINE_HEIGHT / 2;
  const centreNode: PlacedNode = {
    x: 0,
    y: 0,
    label: {
      ...centreCut,
      x: 0,
      y: centreY,
      anchor: "middle",
      side: "below",
      box: centred(0, centreY, widthOf(centreCut)),
    },
  };
  const all = [centreNode, ...nodes];
  separate(all.map((node) => node.label));
  const reach = Math.max(
    MIN_WIDTH / 2 - MARGIN,
    ...all.map((node) => Math.max(-node.label.box.left, node.label.box.right)),
  );
  const halfWidth = reach + MARGIN;
  const above = radius + PAD;
  const below = Math.max(above, ...all.map((node) => node.label.box.bottom + MARGIN));
  return {
    width: 2 * halfWidth,
    height: above + below,
    centre: translate(centreNode, halfWidth, above),
    nodes: nodes.map((node) => translate(node, halfWidth, above)),
  };
}
