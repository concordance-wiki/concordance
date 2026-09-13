import en from "../../messages/en/mentions.json" with { type: "json" };
import fr from "../../messages/fr/mentions.json" with { type: "json" };

import type { Area } from "../area.js";

export const mentionsMessages = {
  en,
  fr,
  arguments: {
    "mentions.atLine": { line: "number" },
    "mentions.inSection": { section: "argument" },
  },
} as const satisfies Area<keyof typeof en>;
