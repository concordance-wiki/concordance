import source from "../messages/en.json" with { type: "json" };
import fr from "../messages/fr.json" with { type: "json" };

import type { MessageId } from "./ids.js";
import { byMessageId } from "./ids.js";

export const SOURCE_LANGUAGE = "en";

/** The shipped catalogues, flat, by language; adding a locale means adding its file here. */
export const shipped: Readonly<Record<string, Readonly<Record<MessageId, string>>>> = {
  en: byMessageId((id) => source[id].defaultMessage),
  fr,
};

/** The languages that ship with a catalogue, in sorted order. */
export const shippedLanguages: readonly string[] = Object.keys(shipped).sort();
