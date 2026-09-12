import type { SiteConfig } from "@concordance-wiki/core";

import type { DisplayOptions } from "./types.js";

const DEFAULT_SIZE = 6;

/** `site.neighbourhood.size` of the configuration, 6 when unset. */
export function displayOptions(site?: SiteConfig): DisplayOptions {
  return { size: site?.neighbourhood?.size ?? DEFAULT_SIZE };
}
