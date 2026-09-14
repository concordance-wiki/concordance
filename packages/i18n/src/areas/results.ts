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
    "results.existsElsewhere": {},
    "results.liftFilter": {},
    "results.noFileUses": {},
    "results.noResultFiltered": { count: "plural" },
    "results.noResultFor": {},
    "results.noteless": {},
    "results.notelessNote": {},
    "results.prefixNote": {},
    "results.seeWordPage": {},
    "results.showNext": { count: "plural" },
    "results.usedIn": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
