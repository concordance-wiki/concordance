import en from "../../messages/en/drawer.json" with { type: "json" };
import fr from "../../messages/fr/drawer.json" with { type: "json" };

import type { Area } from "../area.js";

export const drawerMessages = {
  en,
  fr,
  arguments: {
    "drawer.menu": {},
  },
} as const satisfies Area<keyof typeof en>;
