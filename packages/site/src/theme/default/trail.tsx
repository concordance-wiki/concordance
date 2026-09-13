import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { TrailLabels, TrailProps } from "../../slots.js";
import { labels } from "./labels.js";

export const TRAIL_ISLAND = "trail";

/** The labels of the default theme, used when the header receives no trail. */
export const defaultTrailLabels: TrailLabels = {
  title: labels.trailTitle,
  pin: labels.trailPin,
  unpin: labels.trailUnpin,
  empty: labels.trailEmpty,
  earlier: labels.trailEarlier,
};

/**
 * The island is served empty: the trail lives in the URL fragment and in the reader's storage,
 * which only a script can read, so without JavaScript the region holds nothing and takes no space.
 */
function TrailRegion(): null {
  return null;
}

const TrailIsland = island<TrailProps>(TRAIL_ISLAND, TrailRegion);

export function Trail({ trail }: { trail?: TrailProps }): JSX.Element {
  return <TrailIsland {...(trail ?? { base: "", labels: defaultTrailLabels })} />;
}
