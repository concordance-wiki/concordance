import en from "../../messages/en/pins.json" with { type: "json" };
import fr from "../../messages/fr/pins.json" with { type: "json" };

import type { Area } from "../area.js";

export const pinsMessages = {
  en,
  fr,
  arguments: {
    "pins.all": {},
    "pins.confirmRemoveAll": {},
    "pins.countMany": {},
    "pins.countOne": {},
    "pins.filter": {},
    "pins.label": {},
    "pins.pages": {},
    "pins.pin": {},
    "pins.pinned": {},
    "pins.removeAll": {},
    "pins.unpin": {},
  },
} as const satisfies Area<keyof typeof en>;
