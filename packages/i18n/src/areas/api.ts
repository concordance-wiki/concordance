import en from "../../messages/en/api.json" with { type: "json" };
import fr from "../../messages/fr/api.json" with { type: "json" };

import type { Area } from "../area.js";

export const apiMessages = {
  en,
  fr,
  arguments: {
    "api.callers": { count: "plural" },
    "api.colCallers": {},
    "api.colMethod": {},
    "api.colOperation": {},
    "api.colPath": {},
    "api.contract": {},
    "api.download": {},
    "api.fiveKeys": {},
    "api.gapsLead": {},
    "api.imported": { when: "argument" },
    "api.noOperation": {},
    "api.notInContract": {},
    "api.operations": {},
    "api.operationsFirst": {},
    "api.operationsLead": {},
    "api.unknownPath": {},
    "api.viewerNote": {},
    "api.withoutPage": {},
  },
} as const satisfies Area<keyof typeof en>;
