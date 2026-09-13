import type { JSX } from "preact";

import {
  CENTRE_RADIUS,
  FONT_SIZE,
  layoutNeighbourhood,
  NODE_RADIUS,
  type PlacedLabel,
  type PlacedNode,
} from "../../neighbourhood/layout.js";
import type { Neighbour, NeighbourhoodProps } from "../../slots.js";
import { GLYPH_SHAPES, initialOfGlyph, shapeOfGlyph, type GlyphShape } from "./glyphs.js";
import { labels } from "./labels.js";

/** The id of the textual list; one neighbourhood per page, so one id. */
export const NEIGHBOURHOOD_LIST = "neighbourhood-list";
/** The heading of the mentions panel, where the reader is sent when the map is not drawn. */
const MENTIONS_ANCHOR = "#mentions-title";
const GLYPH_SIZE = 10;
/** The dash of everything that stands for a noteless word: its square and the edge leading to it. */
const KEYWORD_DASH = "4 3";

/** A label in plain text; the full title follows in a `<title>` when the text is cut. */
function Label({ label }: { label: PlacedLabel }): JSX.Element {
  return (
    <text class="map-label" x={label.x} y={label.y} dy="0.35em" text-anchor={label.anchor}>
      {label.full !== undefined && <title>{label.full}</title>}
      {label.text}
    </text>
  );
}

/** The glyph of a type: a shape of the sprite when the theme has one for the glyph name, its initial otherwise. */
function Glyph({ glyph, x, y }: { glyph: string; x: number; y: number }): JSX.Element {
  const shape = shapeOfGlyph(glyph);
  if (shape === undefined) {
    return (
      <text class="map-glyph" x={x} y={y} dy="0.35em" text-anchor="middle">
        {initialOfGlyph(glyph)}
      </text>
    );
  }
  return (
    <use
      class="map-glyph"
      href={`#glyph-${shape}`}
      x={x - GLYPH_SIZE / 2}
      y={y - GLYPH_SIZE / 2}
      width={GLYPH_SIZE}
      height={GLYPH_SIZE}
    />
  );
}

/** A node: a circle for a typed entity, a dashed square for a noteless word, the type glyph inside, the label beside. */
function Node({ neighbour, node }: { neighbour: Neighbour; node: PlacedNode }): JSX.Element {
  const keyword = neighbour.kind === "keyword";
  return (
    <g
      class={keyword ? "map-node map-node-keyword" : "map-node map-node-entity"}
      data-weight={neighbour.weight}
      data-glyph={neighbour.typeGlyph}
    >
      {keyword ? (
        <rect
          class="map-shape"
          x={node.x - NODE_RADIUS}
          y={node.y - NODE_RADIUS}
          width={2 * NODE_RADIUS}
          height={2 * NODE_RADIUS}
          stroke-dasharray={KEYWORD_DASH}
        />
      ) : (
        <circle class="map-shape" cx={node.x} cy={node.y} r={NODE_RADIUS} />
      )}
      {neighbour.typeGlyph !== undefined && (
        <Glyph glyph={neighbour.typeGlyph} x={node.x} y={node.y} />
      )}
      <Label label={node.label} />
    </g>
  );
}

/** The shapes the map uses, once each, in a stable order. */
function spriteOf(neighbours: readonly Neighbour[]): GlyphShape[] {
  const shapes = new Set<GlyphShape>();
  for (const neighbour of neighbours) {
    const shape = neighbour.typeGlyph === undefined ? undefined : shapeOfGlyph(neighbour.typeGlyph);
    if (shape !== undefined) shapes.add(shape);
  }
  return [...shapes].sort();
}

/**
 * The map of the neighbourhood, hidden from assistive technologies: the list next to it is
 * authoritative. Integer positions only, so that two builds give the same bytes.
 */
function Map({ centre, neighbours }: NeighbourhoodProps): JSX.Element {
  const layout = layoutNeighbourhood(centre, neighbours, (neighbour) => neighbour.label);
  const sprite = spriteOf(neighbours);
  return (
    <svg
      class="neighbourhood-graph"
      viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
      font-size={FONT_SIZE}
      aria-hidden="true"
      focusable="false"
    >
      {sprite.length > 0 && (
        <defs>
          {sprite.map((shape) => (
            <symbol key={shape} id={`glyph-${shape}`} viewBox="0 0 10 10">
              <path d={GLYPH_SHAPES[shape]} />
            </symbol>
          ))}
        </defs>
      )}
      {layout.nodes.map((node) =>
        node.item.kind === "keyword" ? (
          <line
            key={node.item.id}
            class="map-edge map-edge-keyword"
            x1={layout.centre.x}
            y1={layout.centre.y}
            x2={node.x}
            y2={node.y}
            stroke-dasharray={KEYWORD_DASH}
          />
        ) : (
          <line
            key={node.item.id}
            class="map-edge"
            x1={layout.centre.x}
            y1={layout.centre.y}
            x2={node.x}
            y2={node.y}
          />
        ),
      )}
      {layout.nodes.map((node) => (
        <Node key={node.item.id} neighbour={node.item} node={node} />
      ))}
      <g class="map-centre">
        <circle class="map-shape" cx={layout.centre.x} cy={layout.centre.y} r={CENTRE_RADIUS} />
        <Label label={layout.centre.label} />
      </g>
    </svg>
  );
}

/** A neighbour opens a new priority group when its rank differs from the previous one's. */
function opensGroup(neighbours: Neighbour[], index: number): boolean {
  const previous = neighbours[index - 1];
  return previous !== undefined && previous.rank !== neighbours[index]?.rank;
}

/**
 * The neighbourhood: the map, or a pointer to the mentions panel when the model holds more
 * neighbours than the map may show, then the textual list every graphical view must keep. The
 * list is rendered in the order received; a separator marks each change of priority group.
 */
export function Neighbourhood({ centre, neighbours, total }: NeighbourhoodProps): JSX.Element {
  const overflow = total !== undefined && total > neighbours.length;
  return (
    <section class="neighbourhood" aria-labelledby="neighbourhood-title">
      <h2 id="neighbourhood-title">
        {labels.neighbourhood} <span class="neighbourhood-centre">{centre}</span>
      </h2>
      {neighbours.length === 0 ? (
        <p class="empty">{labels.noNeighbour}</p>
      ) : (
        <>
          {overflow ? (
            <p class="neighbourhood-overflow">
              {String(total)} {labels.neighboursInTotal}:{" "}
              <a href={MENTIONS_ANCHOR}>{labels.seeMentions}</a>.
            </p>
          ) : (
            <figure class="neighbourhood-map" aria-describedby={NEIGHBOURHOOD_LIST}>
              <Map centre={centre} neighbours={neighbours} />
              <figcaption>
                {labels.neighbourhoodMap}. {labels.neighbourhoodMapCaption}
              </figcaption>
            </figure>
          )}
          <ul id={NEIGHBOURHOOD_LIST} class="neighbour-list">
            {neighbours.map((neighbour, index) => (
              <li
                key={neighbour.id}
                class={opensGroup(neighbours, index) ? "neighbour group-start" : "neighbour"}
              >
                <a href={neighbour.href}>{neighbour.label}</a>
                {neighbour.typeLabel !== undefined && (
                  <span class="badge">{neighbour.typeLabel}</span>
                )}
                {neighbour.relation !== undefined && (
                  <span class="relation">{neighbour.relation}</span>
                )}
                <span class="weight">{neighbour.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
