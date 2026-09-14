import en from "../../messages/en/footer.json" with { type: "json" };
import fr from "../../messages/fr/footer.json" with { type: "json" };

import type { Area } from "../area.js";

export const footerMessages = {
  en,
  fr,
  arguments: {
    "footer.accessibility": {},
    "footer.accessibilityWith": { status: "argument" },
    "footer.buildAt": { day: "date", time: "time" },
    "footer.builtWith": {},
    "footer.compliant": {},
    "footer.content": {},
    "footer.declared": {},
    "footer.generator": {},
    "footer.licence": {},
    "footer.mentions": {},
    "footer.nonCompliant": {},
    "footer.pages": { count: "plural" },
    "footer.partiallyCompliant": {},
    "footer.privacy": {},
    "footer.profile": { profile: "argument" },
    "footer.publication": {},
    "footer.published": { day: "date", time: "time" },
    "footer.repositories": { count: "plural" },
    "footer.sources": {},
    "footer.thisSite": {},
  },
} as const satisfies Area<keyof typeof en>;
