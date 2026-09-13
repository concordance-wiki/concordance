import en from "../../messages/en/search.json" with { type: "json" };
import fr from "../../messages/fr/search.json" with { type: "json" };

import type { Area } from "../area.js";

export const searchMessages = {
  en,
  fr,
  arguments: {
    "search.activeFilters": {},
    "search.clear": {},
    "search.facet.application": {},
    "search.facet.domain": {},
    "search.facet.noNote": {},
    "search.facet.source": {},
    "search.facet.type": {},
    "search.facets": {},
    "search.noNote.any": {},
    "search.noNote.exclude": {},
    "search.noNote.only": {},
    "search.noResult": {},
    "search.removeFilter": {},
    "search.results": { count: "plural" },
  },
} as const satisfies Area<keyof typeof en>;
