import { hydrate } from "preact";

import { MENTIONS_ISLAND, MentionsMore } from "../theme/default/mentions-more.js";
import { mountIslands } from "./mount.js";

mountIslands(MENTIONS_ISLAND, MentionsMore, document, hydrate);
