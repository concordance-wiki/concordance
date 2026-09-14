import en from "../../messages/en/panels.json" with { type: "json" };
import fr from "../../messages/fr/panels.json" with { type: "json" };

import type { Area } from "../area.js";

export const panelsMessages = {
  en,
  fr,
  arguments: {
    "panels.fold": {},
    "panels.panel": {},
  },
} as const satisfies Area<keyof typeof en>;
