import type { JSX } from "preact";

import {
  CENTRE_RADIUS,
  FONT_SIZE,
  layoutNeighbourhood,
  NODE_RADIUS,
  type PlacedLabel,
  type PlacedNode,
} from "../../neighbourhood/layout.js";
import { byCodeUnit } from "../../order.js";
import type { Neighbour, NeighbourhoodLabels, NeighbourhoodProps } from "../../slots.js";
import { GLYPH_SHAPES, initialOfGlyph, shapeOfGlyph, type GlyphShape } from "./glyphs.js";
import { labels } from "./labels.js";
import { fill } from "./mention-list.js";

/** The id of the textual list; one neighbourhood per page, so one id. */
export const NEIGHBOURHOOD_LIST = "neighbourhood-list";
/** The heading of the mentions panel, where the reader is sent when the page has no neighbour. */
const MENTIONS_ANCHOR = "#mentions-title";
/** The prefix of the id of a type checkbox; the stylesheet hides the nodes of an unticked type by its rank. */
const TYPE_INPUT = "neighbourhood-type";
const GLYPH_SIZE = 8;
/** The dash of everything that stands for a noteless word: its square and the edge leading to it. */
const KEYWORD_DASH = "4 3";

/**
 * The labels of the default theme, used for every label the map does not receive; the heading
 * of the list is worded from the number listed, the sentence under the map from the number the
 * model holds.
 */
export function defaultNeighbourhoodLabels(listed: number, total: number): NeighbourhoodLabels {
  return {
    map: labels.neighbourhoodMap,
    mapCaption: labels.neighbourhoodMapCaption,
    distance: labels.distance,
    hop: labels.oneHop,
    types: labels.types,
    existingPage: labels.existingPage,
    noteless: labels.wordWithoutNote,
    neighbours: fill(listed === 1 ? labels.theNeighbour : labels.theNeighbours, { count: listed }),
    textualEquivalent: labels.textualEquivalent,
    capNote: labels.neighbourhoodCap,
    noNeighbour: labels.noNeighbour,
    total: fill(labels.neighboursInTotal, { count: total }),
    seeMentions: labels.seeMentions,
  };
}

/** The mark of the fold line: a centre linked to four neighbours, decorative. */
export function NeighbourhoodIcon(): JSX.Element {
  return (
    <svg
      class="neighbourhood-icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path class="neighbourhood-icon-edges" d="M12 12 4 5m8 7 8-7m-8 7-8 7m8-7 8 7" />
      <circle class="neighbourhood-icon-centre" cx="12" cy="12" r="3" />
      <circle cx="4" cy="5" r="2" />
      <circle cx="20" cy="5" r="2" />
      <circle cx="4" cy="19" r="2" />
      <circle cx="20" cy="19" r="2" />
    </svg>
  );
}

/** A type of the neighbourhood: its label, how many neighbours have it, and its rank in the filter, from one. */
export interface NeighbourType {
  label: string;
  count: number;
  rank: number;
}

/** The types of the neighbours, in the order they first appear, keyed by their label; a neighbour without a type belongs to none. */
export function typesOf(neighbours: readonly Neighbour[]): NeighbourType[] {
  const types = new Map<string, NeighbourType>();
  for (const neighbour of neighbours) {
    if (neighbour.typeLabel === undefined) continue;
    const known = types.get(neighbour.typeLabel);
    if (known === undefined) {
      types.set(neighbour.typeLabel, {
        label: neighbour.typeLabel,
        count: 1,
        rank: types.size + 1,
      });
    } else {
      known.count += 1;
    }
  }
  return [...types.values()];
}

/** The rank of the type of a neighbour in the filter, written on its node and its row; nothing for a neighbour without a type. */
function typeAttribute(neighbour: Neighbour, types: NeighbourType[]): { "data-type"?: string } {
  const type = types.find((candidate) => candidate.label === neighbour.typeLabel);
  return type === undefined ? {} : { "data-type": String(type.rank) };
}

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
function Node({
  neighbour,
  node,
  type,
}: {
  neighbour: Neighbour;
  node: PlacedNode;
  type: { "data-type"?: string };
}): JSX.Element {
  const keyword = neighbour.kind === "keyword";
  return (
    <g
      class={keyword ? "map-node map-node-keyword" : "map-node map-node-entity"}
      data-weight={neighbour.weight}
      data-glyph={neighbour.typeGlyph}
      {...type}
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

/** The edge from the centre to a node, dashed when the node stands for a noteless word. */
function Edge({
  from,
  node,
  type,
}: {
  from: { x: number; y: number };
  node: PlacedNode & { item: Neighbour };
  type: { "data-type"?: string };
}): JSX.Element {
  return node.item.kind === "keyword" ? (
    <line
      class="map-edge map-edge-keyword"
      x1={from.x}
      y1={from.y}
      x2={node.x}
      y2={node.y}
      stroke-dasharray={KEYWORD_DASH}
      {...type}
    />
  ) : (
    <line class="map-edge" x1={from.x} y1={from.y} x2={node.x} y2={node.y} {...type} />
  );
}

/** The shapes the map uses, once each, in a stable order. */
function spriteOf(neighbours: readonly Neighbour[]): GlyphShape[] {
  const shapes = new Set<GlyphShape>();
  for (const neighbour of neighbours) {
    const shape = neighbour.typeGlyph === undefined ? undefined : shapeOfGlyph(neighbour.typeGlyph);
    if (shape !== undefined) shapes.add(shape);
  }
  return [...shapes].sort(byCodeUnit);
}

/**
 * The map of the neighbourhood, hidden from assistive technologies: the list next to it is
 * authoritative. Integer positions only, so that two builds give the same bytes. The edge and
 * the node of one neighbour carry the rank of its type, so that the stylesheet hides both when
 * the type is unticked.
 */
function Graph({
  centre,
  neighbours,
  types,
}: {
  centre: string;
  neighbours: Neighbour[];
  types: NeighbourType[];
}): JSX.Element {
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
      {layout.nodes.map((node) => (
        <Edge
          key={node.item.id}
          from={layout.centre}
          node={node}
          type={typeAttribute(node.item, types)}
        />
      ))}
      {layout.nodes.map((node) => (
        <Node
          key={node.item.id}
          neighbour={node.item}
          node={node}
          type={typeAttribute(node.item, types)}
        />
      ))}
      <g class="map-centre">
        <circle class="map-shape" cx={layout.centre.x} cy={layout.centre.y} r={CENTRE_RADIUS} />
        <Label label={layout.centre.label} />
      </g>
    </svg>
  );
}

/**
 * Above the map: the distance the model records, one hop, and the type filter, a disclosure of
 * checkboxes served all ticked; the stylesheet hides the nodes and the rows of an unticked type
 * by its rank, so that the filter works without any script and over `file://`.
 */
function Controls({
  types,
  text,
}: {
  types: NeighbourType[];
  text: NeighbourhoodLabels;
}): JSX.Element {
  return (
    <div class="neighbourhood-controls">
      <p class="neighbourhood-distance">
        <span class="neighbourhood-distance-label">{text.distance}</span>
        <span class="neighbourhood-hop" aria-current="true">
          {text.hop}
        </span>
      </p>
      {types.length > 0 && (
        <details class="related-types neighbourhood-types">
          <summary>{text.types}</summary>
          <div class="related-type-menu">
            <ul class="related-type-list">
              {types.map((type) => (
                <li key={type.label} class="neighbourhood-type">
                  <input type="checkbox" id={`${TYPE_INPUT}-${String(type.rank)}`} checked />
                  <label for={`${TYPE_INPUT}-${String(type.rank)}`}>
                    {type.label} <span class="count">{type.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

/** A neighbour opens a new priority group when its rank differs from the previous one's. */
function opensGroup(neighbours: Neighbour[], index: number): boolean {
  const previous = neighbours[index - 1];
  return previous !== undefined && previous.rank !== neighbours[index]?.rank;
}

function rowClass(neighbours: Neighbour[], index: number): string {
  const classes = ["neighbour"];
  if (opensGroup(neighbours, index)) classes.push("group-start");
  if (neighbours[index]?.kind === "keyword") classes.push("neighbour-noteless");
  return classes.join(" ");
}

/**
 * The neighbourhood: the map with its controls and its legend as soon as one neighbour is
 * shown, under it the total the model holds when it exceeds the nodes drawn, then the textual
 * list every graphical view must keep and the note saying why the map stops at six; without any
 * neighbour, a pointer to the mentions panel. The list is rendered in the order received; a
 * separator marks each change of priority group.
 */
export function Neighbourhood({
  centre,
  neighbours,
  total,
  labels: given = {},
}: NeighbourhoodProps): JSX.Element {
  const overflow = total !== undefined && total > neighbours.length;
  const text: NeighbourhoodLabels = {
    ...defaultNeighbourhoodLabels(neighbours.length, total ?? neighbours.length),
    ...given,
  };
  const types = typesOf(neighbours);
  return (
    <section class="neighbourhood" aria-labelledby="neighbourhood-title">
      <h2 id="neighbourhood-title">
        {text.map} <span class="neighbourhood-centre">{centre}</span>
      </h2>
      {neighbours.length === 0 ? (
        <p class="empty">
          {text.noNeighbour} <a href={MENTIONS_ANCHOR}>{text.seeMentions}</a>.
        </p>
      ) : (
        <>
          <Controls types={types} text={text} />
          <figure class="neighbourhood-map" aria-describedby={NEIGHBOURHOOD_LIST}>
            <Graph centre={centre} neighbours={neighbours} types={types} />
            <figcaption>
              <span class="visually-hidden">
                {text.map}. {text.mapCaption}
              </span>
              <span class="map-legend">
                <span class="map-legend-entity">{text.existingPage}</span>
                <span class="map-legend-keyword">{text.noteless}</span>
              </span>
            </figcaption>
          </figure>
          {overflow && <p class="neighbourhood-total">{text.total}.</p>}
          <p class="neighbourhood-list-head">
            <span class="section-label">{text.neighbours}</span>
            <span class="neighbourhood-equivalent">{text.textualEquivalent}</span>
          </p>
          <ul id={NEIGHBOURHOOD_LIST} class="neighbour-list">
            {neighbours.map((neighbour, index) => (
              <li
                key={neighbour.id}
                class={rowClass(neighbours, index)}
                {...typeAttribute(neighbour, types)}
              >
                <a href={neighbour.href}>{neighbour.label}</a>
                {neighbour.typeLabel !== undefined && (
                  <span class="neighbour-type">{neighbour.typeLabel}</span>
                )}
                {neighbour.relation !== undefined && (
                  <span class="relation">{neighbour.relation}</span>
                )}
                <span class="weight">{neighbour.weight}</span>
              </li>
            ))}
          </ul>
          <p class="neighbourhood-note">{text.capNote}</p>
        </>
      )}
    </section>
  );
}
