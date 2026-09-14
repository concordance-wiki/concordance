import en from "../../messages/en/site.json" with { type: "json" };
import fr from "../../messages/fr/site.json" with { type: "json" };

import type { Area } from "../area.js";

export const siteMessages = {
  en,
  fr,
  arguments: {
    "site.darkMode": {},
    "site.generatedAt": { date: "date" },
    "site.home": {},
    "site.index": {},
    "site.recent": {},
    "site.search": {},
    "site.searchPlaceholder": {},
    "site.skipToContent": {},
    "site.spaces": {},
    "site.todo": {},
    "site.version": {},
  },
} as const satisfies Area<keyof typeof en>;
