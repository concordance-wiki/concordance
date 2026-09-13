import { h } from "preact";
import { renderToString } from "preact-render-to-string";

import { NeighbourhoodIcon } from "../../src/theme/default/neighbourhood.js";

/** The mark of the fold line as the default theme serves it, for the tests that pin the summary. */
export const NEIGHBOURHOOD_ICON = renderToString(h(NeighbourhoodIcon, {}));
