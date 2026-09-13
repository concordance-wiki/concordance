import en from "../../messages/en/category.json" with { type: "json" };
import fr from "../../messages/fr/category.json" with { type: "json" };

import type { Area } from "../area.js";

export const categoryMessages = {
  en,
  fr,
  arguments: {
    "category.all": {},
    "category.filedUnder": { count: "plural", path: "argument" },
    "category.firstLine": {},
    "category.links": {},
    "category.linksNote": { name: "argument" },
    "category.page": {},
    "category.pages": { count: "plural" },
    "category.pagesName": {},
    "category.pagination": {},
    "category.searchIn": { name: "argument" },
    "category.shown": { shown: "argument", name: "argument", total: "argument" },
    "category.sort": {},
    "category.sortLinks": {},
    "category.sortTitle": {},
  },
} as const satisfies Area<keyof typeof en>;
