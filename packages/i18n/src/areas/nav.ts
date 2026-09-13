import en from "../../messages/en/nav.json" with { type: "json" };
import fr from "../../messages/fr/nav.json" with { type: "json" };

import type { Area } from "../area.js";

export const navMessages = {
  en,
  fr,
  arguments: {
    "nav.applications": {},
    "nav.domains": {},
    "nav.index": {},
    "nav.types": {},
  },
} as const satisfies Area<keyof typeof en>;
