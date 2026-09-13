import en from "../../messages/en/results.json" with { type: "json" };
import fr from "../../messages/fr/results.json" with { type: "json" };

import type { Area } from "../area.js";

export const resultsMessages = {
  en,
  fr,
  arguments: {
    "results.alsoCalled": {},
    "results.broader": {},
    "results.cited": { count: "plural" },
    "results.clearQuery": {},
    "results.closestForm": {},
    "results.countersNote": {},
    "results.noResultFor": {},
    "results.notelessNote": {},
    "results.usedIn": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
