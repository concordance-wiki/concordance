import en from "../../messages/en/decision.json" with { type: "json" };
import fr from "../../messages/fr/decision.json" with { type: "json" };

import type { Area } from "../area.js";

export const decisionMessages = {
  en,
  fr,
  arguments: {
    "decision.decidedOn": {},
    "decision.keysNote": { count: "plural" },
    "decision.relatedNote": {},
    "decision.session": {},
    "decision.sessionDated": { date: "argument" },
    "decision.sessionMinutes": {},
    "decision.sessionPassage": { time: "argument" },
    "decision.sessionSee": {},
    "decision.sessionUndated": {},
    "decision.status": {},
    "decision.status.accepted": {},
    "decision.status.proposed": {},
    "decision.status.superseded": {},
    "decision.supersededBy": {},
    "decision.supersedes": {},
  },
} as const satisfies Area<keyof typeof en>;
