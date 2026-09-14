import en from "../../messages/en/keyword.json" with { type: "json" };
import fr from "../../messages/fr/keyword.json" with { type: "json" };

import type { Area } from "../area.js";

export const keywordMessages = {
  en,
  fr,
  arguments: {
    "keyword.createNote": {},
    "keyword.factFiles": {},
    "keyword.factOccurrences": {},
    "keyword.factSpaces": {},
    "keyword.filesSummary": { count: "plural" },
    "keyword.maybeSame": {},
    "keyword.noDefinition": {},
    "keyword.noProperty": {},
    "keyword.noteWritten": {},
    "keyword.noticeDetail": {},
    "keyword.noticeLead": { count: "plural" },
    "keyword.occurrences": { count: "plural" },
    "keyword.otherPassages": { count: "plural" },
    "keyword.pageAt": { number: "number" },
    "keyword.passagesTitle": {},
    "keyword.relatedNote": {},
    "keyword.showOtherFiles": { count: "plural" },
    "keyword.similarLead": {},
    "keyword.slideAt": { number: "number" },
    "keyword.terms": {},
    "keyword.title": {},
    "keyword.undefinedExpression": {},
    "keyword.usedSince": { month: "argument" },
    "keyword.whatWeKnow": {},
  },
} as const satisfies Area<keyof typeof en>;
