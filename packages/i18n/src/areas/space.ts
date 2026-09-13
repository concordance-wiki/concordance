import en from "../../messages/en/space.json" with { type: "json" };
import fr from "../../messages/fr/space.json" with { type: "json" };

import type { Area } from "../area.js";

export const spaceMessages = {
  en,
  fr,
  arguments: {
    "space.browse": {},
    "space.categoriesLead": { count: "plural" },
    "space.categoriesNote": {},
    "space.footer": {},
    "space.mostCited": {},
    "space.repository": {},
    "space.searchPlaceholder": {},
    "space.updated": { when: "argument" },
    "space.wordsNote": {},
  },
} as const satisfies Area<keyof typeof en>;
