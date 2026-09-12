import type { JSX } from "preact";

import type { NeighbourhoodProps } from "../../slots.js";
import { labels } from "./labels.js";

/** The textual neighbourhood, the equivalent every graphical view must keep. */
export function Neighbourhood({ centre, neighbours }: NeighbourhoodProps): JSX.Element {
  return (
    <section class="neighbourhood" aria-labelledby="neighbourhood-title">
      <h2 id="neighbourhood-title">
        {labels.neighbourhood} <span class="neighbourhood-centre">{centre}</span>
      </h2>
      {neighbours.length === 0 ? (
        <p class="empty">{labels.noNeighbour}</p>
      ) : (
        <ul class="neighbour-list">
          {neighbours.map((neighbour) => (
            <li key={neighbour.id} class="neighbour">
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
      )}
    </section>
  );
}
