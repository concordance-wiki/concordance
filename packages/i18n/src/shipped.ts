import type { MessageId } from "./ids.js";
import { byCodeUnit, byMessageId, french, source } from "./ids.js";

export const SOURCE_LANGUAGE = "en";

/** The shipped catalogues, flat, by language, in identifier order; adding a locale means adding it here. */
export const shipped: Readonly<Record<string, Readonly<Record<MessageId, string>>>> = {
  en: byMessageId((id) => source[id].defaultMessage),
  fr: byMessageId((id) => french[id]),
};

/** The languages that ship with a catalogue, in sorted order. */
export const shippedLanguages: readonly string[] = Object.keys(shipped).sort(byCodeUnit);
