import { h, hydrate, type JSX } from "preact";

import {
  MENTIONS_ISLAND,
  MentionsIsland,
  type MentionsIslandProps,
} from "../theme/default/mentions-island.js";
import { restOf } from "./mentions-rest.js";
import { mountIslands } from "./mount.js";

function Hydrated(props: MentionsIslandProps): JSX.Element {
  const rest = restOf(document, location.protocol, props.fragmentHref, (href) => fetch(href));
  return h(MentionsIsland, { ...props, ...(rest === undefined ? {} : { rest }) });
}

mountIslands(MENTIONS_ISLAND, Hydrated, document, hydrate);
