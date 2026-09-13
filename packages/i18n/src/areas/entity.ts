import en from "../../messages/en/entity.json" with { type: "json" };
import fr from "../../messages/fr/entity.json" with { type: "json" };

import type { Area } from "../area.js";

export const entityMessages = {
  en,
  fr,
  arguments: {
    "entity.application": {},
    "entity.attributes": {},
    "entity.breadcrumb": {},
    "entity.changed": { when: "argument" },
    "entity.confidence": { value: "number" },
    "entity.correction": {},
    "entity.declaredAtTop": { count: "plural" },
    "entity.domain": {},
    "entity.edit": {},
    "entity.imageNote": {},
    "entity.inSpace": { space: "argument" },
    "entity.legendKeyword": {},
    "entity.legendRecognised": {},
    "entity.legendWritten": {},
    "entity.markNoNote": { count: "plural" },
    "entity.markNote": { title: "argument" },
    "entity.mentions": {},
    "entity.mentionsCount": { count: "plural" },
    "entity.neighbourPages": { count: "plural" },
    "entity.neighbours": {},
    "entity.onThisPage": {},
    "entity.otherAttributes": {},
    "entity.otherPages": { count: "plural" },
    "entity.relatedTo": {},
    "entity.seeNeighbourhood": {},
    "entity.showLess": {},
    "entity.showMore": {},
    "entity.sources": {},
    "entity.spaceTree": {},
    "entity.status": {},
    "entity.type": {},
  },
} as const satisfies Area<keyof typeof en>;
