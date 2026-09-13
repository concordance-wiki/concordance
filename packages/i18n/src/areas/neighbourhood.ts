import en from "../../messages/en/neighbourhood.json" with { type: "json" };
import fr from "../../messages/fr/neighbourhood.json" with { type: "json" };

import type { Area } from "../area.js";

export const neighbourhoodMessages = {
  en,
  fr,
  arguments: {
    "neighbourhood.capNote": {},
    "neighbourhood.distance": {},
    "neighbourhood.existingPage": {},
    "neighbourhood.hop": { count: "plural" },
    "neighbourhood.list": { count: "plural" },
    "neighbourhood.map": {},
    "neighbourhood.mapCaption": {},
    "neighbourhood.none": {},
    "neighbourhood.noteless": {},
    "neighbourhood.seeMentions": {},
    "neighbourhood.textualEquivalent": {},
    "neighbourhood.total": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
