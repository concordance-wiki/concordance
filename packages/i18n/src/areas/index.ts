import en from "../../messages/en/index.json" with { type: "json" };
import fr from "../../messages/fr/index.json" with { type: "json" };

import type { Area } from "../area.js";

export const indexMessages = {
  en,
  fr,
  arguments: {
    "index.bySpace": {},
    "index.byType": {},
    "index.columnDescription": {},
    "index.columnPages": {},
    "index.columnType": {},
    "index.columnWord": {},
    "index.empty": {},
    "index.filters": {},
    "index.lead": { words: "plural", notes: "plural" },
    "index.letters": {},
    "index.lettersWithout": { count: "plural" },
    "index.noDefinition": {},
    "index.note": {},
    "index.passage": { passage: "argument", title: "argument" },
    "index.title": {},
    "index.withoutDefinition": {},
    "index.words": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
