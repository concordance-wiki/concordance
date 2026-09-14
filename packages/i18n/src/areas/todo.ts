import en from "../../messages/en/todo.json" with { type: "json" };
import fr from "../../messages/fr/todo.json" with { type: "json" };

import type { Area } from "../area.js";

export const todoMessages = {
  en,
  fr,
  arguments: {
    "todo.contribute": {},
    "todo.findings": { count: "plural" },
    "todo.noise": {},
    "todo.noiseNote": {},
    "todo.reasonBurst": { count: "number" },
    "todo.reasonMorphology": {},
    "todo.reasonSpread": { share: "number" },
    "todo.severity.error": {},
    "todo.severity.info": {},
    "todo.severity.warning": {},
    "todo.showOthers": { count: "plural" },
    "todo.title": {},
  },
} as const satisfies Area<keyof typeof en>;
