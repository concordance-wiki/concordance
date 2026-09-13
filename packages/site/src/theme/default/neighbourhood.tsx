import type { JSX } from "preact";

import type { Neighbour, NeighbourhoodProps } from "../../slots.js";
import { labels } from "./labels.js";

/** The id of the textual list; one neighbourhood per page, so one id. */
export const NEIGHBOURHOOD_LIST = "neighbourhood-list";

const WIDTH = 480;
const ROW = 32;
const MARGIN = 16;
const CENTRE_X = WIDTH / 2;
const SIDE_X = { left: 120, right: 360 } as const;
const LABEL_GAP = 12;

interface Placed {
  neighbour: Neighbour;
  x: number;
  y: number;
  side: keyof typeof SIDE_X;
}

/** Neighbours alternate left and right of the centre, one per row, so that no two labels share a line. */
function place(neighbours: Neighbour[]): { placed: Placed[]; height: number } {
  const rows = Math.ceil(neighbours.length / 2);
  const height = rows * ROW + 2 * MARGIN;
  const placed = neighbours.map((neighbour, index): Placed => {
    const side = index % 2 === 0 ? "left" : "right";
    const row = Math.floor(index / 2);
    return { neighbour, side, x: SIDE_X[side], y: MARGIN + ROW / 2 + row * ROW };
  });
  return { placed, height };
}

/**
 * A star map of the neighbourhood, hidden from assistive technologies: the list next to it is
 * authoritative. Integer positions only, so that two builds give the same bytes.
 */
function Map({ centre, neighbours }: NeighbourhoodProps): JSX.Element {
  const { placed, height } = place(neighbours);
  const centreY = height / 2;
  return (
    <svg
      class="neighbourhood-graph"
      viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
      aria-hidden="true"
      focusable="false"
    >
      {placed.map(({ neighbour, x, y }) => (
        <line key={neighbour.id} class="map-edge" x1={CENTRE_X} y1={centreY} x2={x} y2={y} />
      ))}
      {placed.map(({ neighbour, x, y, side }) => (
        <g key={neighbour.id} class="map-node" data-weight={neighbour.weight}>
          <circle cx={x} cy={y} r={5} />
          <text
            x={side === "left" ? x - LABEL_GAP : x + LABEL_GAP}
            y={y}
            dy="0.35em"
            text-anchor={side === "left" ? "end" : "start"}
          >
            {neighbour.label}
          </text>
        </g>
      ))}
      <g class="map-centre">
        <circle cx={CENTRE_X} cy={centreY} r={7} />
        <text x={CENTRE_X} y={centreY + LABEL_GAP} dy="0.9em" text-anchor="middle">
          {centre}
        </text>
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
 * The neighbourhood: a map placeholder and the textual list every graphical view must keep. The
 * list is rendered in the order received; a separator marks each change of priority group.
 */
export function Neighbourhood({ centre, neighbours }: NeighbourhoodProps): JSX.Element {
  return (
    <section class="neighbourhood" aria-labelledby="neighbourhood-title">
      <h2 id="neighbourhood-title">
        {labels.neighbourhood} <span class="neighbourhood-centre">{centre}</span>
      </h2>
      {neighbours.length === 0 ? (
        <p class="empty">{labels.noNeighbour}</p>
      ) : (
        <>
          <figure class="neighbourhood-map" aria-describedby={NEIGHBOURHOOD_LIST}>
            <Map centre={centre} neighbours={neighbours} />
            <figcaption>
              {labels.neighbourhoodMap}. {labels.neighbourhoodMapCaption}
            </figcaption>
          </figure>
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
