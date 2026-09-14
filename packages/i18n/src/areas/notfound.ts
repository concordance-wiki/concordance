import en from "../../messages/en/notfound.json" with { type: "json" };
import fr from "../../messages/fr/notfound.json" with { type: "json" };

import type { Area } from "../area.js";

export const notfoundMessages = {
  en,
  fr,
  arguments: {
    "notfound.browse": {},
    "notfound.cause": {},
    "notfound.label": {},
    "notfound.nearby": {},
    "notfound.search": {},
    "notfound.searchSite": {},
    "notfound.title": {},
  },
} as const satisfies Area<keyof typeof en>;
