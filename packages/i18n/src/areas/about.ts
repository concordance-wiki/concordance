import en from "../../messages/en/about.json" with { type: "json" };
import fr from "../../messages/fr/about.json" with { type: "json" };

import type { Area } from "../area.js";

export const aboutMessages = {
  en,
  fr,
  arguments: {
    "about.content": {},
    "about.contribute": {},
    "about.correct": {},
    "about.correctText": {},
    "about.lastChange": {},
    "about.lead": {},
    "about.nature": {},
    "about.notContained": {},
    "about.notContainedText": { count: "plural" },
    "about.pages": {},
    "about.pseudonymised": {},
    "about.pseudonymisedText": {},
    "about.publishedAt": { day: "date", time: "time" },
    "about.publishedOn": {},
    "about.report": {},
    "about.reportLists": {},
    "about.repository": {},
    "about.sources": {},
    "about.sourcesLead": {},
    "about.staleExceeds": { count: "plural" },
    "about.staleSource": {},
    "about.title": {},
    "about.version": {},
    "about.versionsNote": {},
    "about.words": {},
  },
} as const satisfies Area<keyof typeof en>;
