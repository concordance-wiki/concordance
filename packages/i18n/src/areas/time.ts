import en from "../../messages/en/time.json" with { type: "json" };
import fr from "../../messages/fr/time.json" with { type: "json" };

import type { Area } from "../area.js";

export const timeMessages = {
  en,
  fr,
  arguments: {
    "time.updatedAgo": { when: "argument" },
  },
} as const satisfies Area<keyof typeof en>;
