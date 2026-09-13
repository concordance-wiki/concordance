import en from "../../messages/en/todo.json" with { type: "json" };
import fr from "../../messages/fr/todo.json" with { type: "json" };

import type { Area } from "../area.js";

export const todoMessages = {
  en,
  fr,
  arguments: {
    "todo.findings": { count: "plural" },
    "todo.severity.error": {},
    "todo.severity.info": {},
    "todo.severity.warning": {},
    "todo.title": {},
  },
} as const satisfies Area<keyof typeof en>;
