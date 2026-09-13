import en from "../../messages/en/footer.json" with { type: "json" };
import fr from "../../messages/fr/footer.json" with { type: "json" };

import type { Area } from "../area.js";

export const footerMessages = {
  en,
  fr,
  arguments: {
    "footer.builtWith": {},
  },
} as const satisfies Area<keyof typeof en>;
