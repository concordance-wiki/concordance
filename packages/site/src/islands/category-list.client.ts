import { hydrate } from "preact";

import { CATEGORY_ISLAND, CategoryIsland } from "../theme/default/category-island.js";
import { mountIslands } from "./mount.js";

mountIslands(CATEGORY_ISLAND, CategoryIsland, document, hydrate);
