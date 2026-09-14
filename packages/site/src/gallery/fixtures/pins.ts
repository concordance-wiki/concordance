import type { PinnedPage, SlotProps } from "../../slots.js";
import { corporateHeader } from "./chrome.js";
import { candidateTerm, keywordScreen, thresholdDecision, thresholdReview } from "./corpus.js";
import { defaultPinsLabels } from "../../theme/default/pins.js";

/** The rule being read, pinned first. */
const rule: PinnedPage = { id: "specs/rules/publication-threshold", title: "Publication threshold" };

/** The pages of the fixtures corpus a reader pinned, in the order of pinning: the rule being read among them. */
export const corporatePins: PinnedPage[] = [
  rule,
  { id: thresholdDecision.id, title: thresholdDecision.title },
  { id: thresholdReview.id, title: thresholdReview.title },
  { id: keywordScreen.id, title: keywordScreen.title },
  { id: candidateTerm.id, title: candidateTerm.title },
];

/** The corporate bar with the row of the pinned pages served under it, the rule being read pinned first. */
export const corporatePinnedHeader: SlotProps["Header"] = {
  ...corporateHeader,
  pins: {
    base: "../../",
    current: rule,
    labels: defaultPinsLabels,
    pinned: corporatePins,
  },
};
