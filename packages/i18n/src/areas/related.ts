import en from "../../messages/en/related.json" with { type: "json" };
import fr from "../../messages/fr/related.json" with { type: "json" };

import type { Area } from "../area.js";

export const relatedMessages = {
  en,
  fr,
  arguments: {
    "related.cited": {},
    "related.clearAll": {},
    "related.filter": {},
    "related.fullList": {},
    "related.loadingOthers": {},
    "related.noMatch": {},
    "related.none": {},
    "related.orderNote": {},
    "related.other": {},
    "related.others": {},
    "related.othersUnavailable": {},
    "related.pagesOf": {},
    "related.passage": {},
    "related.passages": {},
    "related.showOthers": {},
    "related.title": {},
    "related.types": {},
  },
} as const satisfies Area<keyof typeof en>;
