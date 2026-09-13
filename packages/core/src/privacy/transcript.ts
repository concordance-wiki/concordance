import type { Finding } from "../model/finding.js";
import { nameKey, pseudonymDictionary, type PseudonymDictionary } from "./dictionary.js";
import {
  createSpeakerNumbering,
  detectPersonalMentions,
  pseudonymizeSpeaker,
  pseudonymizeText,
  type PseudonymizeOptions,
} from "./pseudonymize.js";

export interface TranscriptCueLike {
  speaker?: string;
  text: string;
}

/** What a transcript must expose to be pseudonymised; the reader's own fields travel through untouched. */
export interface TranscriptLike<C extends TranscriptCueLike = TranscriptCueLike> {
  cues: readonly C[];
  /** Unique speakers in order of first appearance. */
  speakers: readonly string[];
}

export interface TranscriptOptions extends PseudonymizeOptions {
  /**
   * Capitalised expressions that name no one, the titles of the notes typically: a mention equal
   * to one of them, compared by name key, is not reported.
   */
  ignore?: readonly string[];
}

export interface PseudonymizedTranscript<T extends TranscriptLike> {
  /** The only form of the transcript that may be rendered, indexed or written anywhere. */
  transcript: T;
  /** One `I-PII-DETECTED` per distinct mention found outside the dictionary. */
  findings: Finding[];
}

/**
 * The substitution of one transcript: its speakers replaced by their pseudonym, role or number,
 * its texts by the dictionary and the numbered speakers alike. The same substitution serves the
 * cues, the metadata and the rewritten file, so that they agree on every name.
 */
export interface TranscriptSubstitution {
  speaker: (name: string) => string;
  text: (text: string) => string;
  /** The declared people and the numbered speakers, in matching order. */
  dictionary: PseudonymDictionary;
}

const REMEDIATION =
  "Add the name to pseudonyms.yaml, or edit the transcript in its source repository.";

function unique(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

/**
 * Numbers the speakers the dictionary does not know in order of first appearance, then extends
 * the dictionary with them so that a cue naming one is replaced the same way as its turns.
 */
export function transcriptSubstitution(
  speakers: readonly string[],
  dictionary: PseudonymDictionary,
  options: PseudonymizeOptions,
): TranscriptSubstitution {
  const numbering = createSpeakerNumbering();
  const speakerOptions = { ...options, numbering };
  const speaker = (name: string): string => pseudonymizeSpeaker(name, dictionary, speakerOptions);
  for (const name of speakers) speaker(name);
  const extend = (): PseudonymDictionary =>
    pseudonymDictionary([...dictionary.people, ...numbering.entries()]);
  let numbered = numbering.entries().length;
  let extended = extend();
  // A speaker numbered after the seeding, met in a later turn, joins the dictionary of the texts.
  const current = (): PseudonymDictionary => {
    if (numbering.entries().length !== numbered) {
      numbered = numbering.entries().length;
      extended = extend();
    }
    return extended;
  };
  return {
    speaker,
    text: (text) => pseudonymizeText(text, current(), options).text,
    get dictionary() {
      return current();
    },
  };
}

/**
 * Replaces every speaker and every dictionary name in the cue texts, numbers the speakers the
 * dictionary does not know in order of first appearance and reports the other personal mentions.
 * Unknown speakers named inside a cue are replaced by their generated pseudonym as well.
 */
export function pseudonymizeTranscript<T extends TranscriptLike>(
  transcript: T,
  dictionary: PseudonymDictionary,
  options: TranscriptOptions,
): PseudonymizedTranscript<T> {
  const substitution = transcriptSubstitution(transcript.speakers, dictionary, options);
  const speakers = unique(transcript.speakers.map(substitution.speaker));
  const ignored = new Set((options.ignore ?? []).map((title) => nameKey(title, options.locale)));
  const seen = new Map<string, Finding>();
  const cues = transcript.cues.map((cue, index) => {
    for (const mention of detectPersonalMentions(cue.text, substitution.dictionary, options)) {
      const key = nameKey(mention.text, options.locale);
      if (!seen.has(key) && !ignored.has(key)) {
        seen.set(key, {
          check: "I-PII-DETECTED",
          severity: "info",
          message: `personal mention "${mention.text}" in cue ${String(index + 1)} at offset ${String(mention.offset)} is not in the pseudonymisation dictionary`,
          remediation: REMEDIATION,
        });
      }
    }
    const text = substitution.text(cue.text);
    return cue.speaker === undefined
      ? { ...cue, text }
      : { ...cue, speaker: substitution.speaker(cue.speaker), text };
  });
  return { transcript: { ...transcript, cues, speakers }, findings: [...seen.values()] };
}
