import en from "../../messages/en/home.json" with { type: "json" };
import fr from "../../messages/fr/home.json" with { type: "json" };

import type { Area } from "../area.js";

export const homeMessages = {
  en,
  fr,
  arguments: {
    "home.browse": {},
    "home.datesNote": {},
    "home.documents": { count: "plural" },
    "home.enterKey": {},
    "home.explanation": {},
    "home.matches": { count: "plural" },
    "home.moreSpaces": { count: "plural" },
    "home.mostCited": {},
    "home.open": {},
    "home.pages": { count: "plural" },
    "home.question": {},
    "home.recent": {},
    "home.seeResults": { count: "plural" },
    "home.spacesLead": {},
    "home.stale": { count: "plural" },
    "home.staleThreshold": { space: "argument", count: "plural" },
    "home.usedIn": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
