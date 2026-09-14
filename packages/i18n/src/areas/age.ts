import en from "../../messages/en/age.json" with { type: "json" };
import fr from "../../messages/fr/age.json" with { type: "json" };

import type { Area } from "../area.js";

export const ageMessages = {
  en,
  fr,
  arguments: {
    "age.cadence": { count: "plural" },
    "age.close": {},
    "age.missing": {},
    "age.notice": {},
    "age.or": {},
    "age.published": { count: "plural" },
    "age.repositories": {},
    "age.sources": {},
  },
} as const satisfies Area<keyof typeof en>;
