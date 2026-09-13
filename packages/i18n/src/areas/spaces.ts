import en from "../../messages/en/spaces.json" with { type: "json" };
import fr from "../../messages/fr/spaces.json" with { type: "json" };

import type { Area } from "../area.js";

export const spacesMessages = {
  en,
  fr,
  arguments: {
    "spaces.content": {},
    "spaces.datesNote": { count: "plural" },
    "spaces.lastUpdate": {},
    "spaces.lead": { count: "plural" },
    "spaces.pages": {},
    "spaces.space": {},
  },
} as const satisfies Area<keyof typeof en>;
