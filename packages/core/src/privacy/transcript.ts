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

export interface PseudonymizedTranscript<T extends TranscriptLike> {
  /** The only form of the transcript that may be rendered, indexed or written anywhere. */
  transcript: T;
  /** One `I-PII-DETECTED` per distinct mention found outside the dictionary. */
  findings: Finding[];
}

const REMEDIATION =
  "Add the name to pseudonyms.yaml, or edit the transcript in its source repository.";

function unique(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

/**
 * Replaces every speaker and every dictionary name in the cue texts, numbers the speakers the
 * dictionary does not know in order of first appearance and reports the other personal mentions.
 * Unknown speakers named inside a cue are replaced by their generated pseudonym as well.
 */
export function pseudonymizeTranscript<T extends TranscriptLike>(
  transcript: T,
  dictionary: PseudonymDictionary,
  options: PseudonymizeOptions,
): PseudonymizedTranscript<T> {
  const numbering = createSpeakerNumbering();
  const speakerOptions = { ...options, numbering };
  const speakerOf = (name: string): string => pseudonymizeSpeaker(name, dictionary, speakerOptions);
  const speakers = unique(transcript.speakers.map(speakerOf));
  const extended = pseudonymDictionary([...dictionary.people, ...numbering.entries()]);
  const seen = new Map<string, Finding>();
  const cues = transcript.cues.map((cue, index) => {
    for (const mention of detectPersonalMentions(cue.text, extended, options)) {
      const key = nameKey(mention.text, options.locale);
      if (!seen.has(key)) {
        seen.set(key, {
          check: "I-PII-DETECTED",
          severity: "info",
          message: `personal mention "${mention.text}" in cue ${String(index + 1)} at offset ${String(mention.offset)} is not in the pseudonymisation dictionary`,
          remediation: REMEDIATION,
        });
      }
    }
    const { text } = pseudonymizeText(cue.text, extended, options);
    return cue.speaker === undefined
      ? { ...cue, text }
      : { ...cue, speaker: speakerOf(cue.speaker), text };
  });
  return { transcript: { ...transcript, cues, speakers }, findings: [...seen.values()] };
}
