import en from "../../messages/en/trail.json" with { type: "json" };
import fr from "../../messages/fr/trail.json" with { type: "json" };

import type { Area } from "../area.js";

export const trailMessages = {
  en,
  fr,
  arguments: {
    "trail.earlier": {},
    "trail.pin": {},
    "trail.title": {},
    "trail.unpin": {},
  },
} as const satisfies Area<keyof typeof en>;
