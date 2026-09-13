import en from "../../messages/en/transcript.json" with { type: "json" };
import fr from "../../messages/fr/transcript.json" with { type: "json" };

import type { Area } from "../area.js";

export const transcriptMessages = {
  en,
  fr,
  arguments: {
    "transcript.duration": {},
    "transcript.speakers": {},
  },
} as const satisfies Area<keyof typeof en>;
