import { describe, expect, it } from "vitest";

import { loadPseudonymDictionary } from "../../src/privacy/dictionary.js";
import { pseudonymizeTranscript } from "../../src/privacy/transcript.js";

const dictionary = loadPseudonymDictionary(`
version: 1
people:
  "Mary Ann Smith": { pseudonym: Participant-1, role: Project lead }
  "Élodie Dupont": { pseudonym: Participant-3, role: Analyst }
  "Bob Ray": { pseudonym: Participant-4, role: Analyst }
`);

interface Cue {
  index: number;
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

const transcript = {
  format: "vtt",
  cues: [
    {
      index: 0,
      start: 0,
      end: 2,
      speaker: "Mary Ann Smith",
      text: "Hi Bob Ray, is Alice Lee here?",
    },
    { index: 1, start: 2, end: 4, speaker: "Alice Lee", text: "Yes. Elodie DUPONT joins later." },
    { index: 2, start: 4, end: 6, text: "(inaudible)" },
    { index: 3, start: 6, end: 8, speaker: "Bob Ray", text: "Firstname Lastname sent the deck." },
    { index: 4, start: 8, end: 9, speaker: "ALICE LEE", text: "Thanks, ask Firstname Lastname." },
  ] satisfies Cue[],
  speakers: ["Mary Ann Smith", "Alice Lee", "Bob Ray", "ALICE LEE"],
  duration: 9,
};

const realNames = [...dictionary.people.map((person) => person.name), "Alice Lee"];

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

describe("pseudonymizeTranscript", () => {
  it("replaces speaker names and detected personal mentions by pseudonyms that are stable from one build to the next", () => {
    const first = pseudonymizeTranscript(transcript, dictionary, { keepRoles: false });
    const second = pseudonymizeTranscript(transcript, dictionary, { keepRoles: false });
    expect(first).toStrictEqual(second);
    expect(first.transcript).toStrictEqual({
      format: "vtt",
      cues: [
        {
          index: 0,
          start: 0,
          end: 2,
          speaker: "Participant-1",
          text: "Hi Participant-4, is Speaker-1 here?",
        },
        {
          index: 1,
          start: 2,
          end: 4,
          speaker: "Speaker-1",
          text: "Yes. Participant-3 joins later.",
        },
        { index: 2, start: 4, end: 6, text: "(inaudible)" },
        {
          index: 3,
          start: 6,
          end: 8,
          speaker: "Participant-4",
          text: "Firstname Lastname sent the deck.",
        },
        {
          index: 4,
          start: 8,
          end: 9,
          speaker: "Speaker-1",
          text: "Thanks, ask Firstname Lastname.",
        },
      ],
      speakers: ["Participant-1", "Speaker-1", "Participant-4"],
      duration: 9,
    });
  });

  it("keeps the role instead of the pseudonym when the configuration asks for it (keep_roles)", () => {
    const { transcript: result } = pseudonymizeTranscript(transcript, dictionary, {
      keepRoles: true,
    });
    expect(result.speakers).toEqual(["Project lead", "Speaker-1", "Analyst"]);
    expect(result.cues.map((cue) => cue.speaker)).toEqual([
      "Project lead",
      "Speaker-1",
      undefined,
      "Analyst",
      "Speaker-1",
    ]);
    expect(result.cues[0]?.text).toBe("Hi Analyst, is Speaker-1 here?");
  });

  it("never writes the mapping dictionary into the output: no real name appears in any produced string", () => {
    for (const keepRoles of [false, true]) {
      const output = pseudonymizeTranscript(transcript, dictionary, { keepRoles });
      const produced = strings(output);
      expect(produced.length).toBeGreaterThan(10);
      for (const name of realNames) {
        const leaked = produced.filter((text) => text.toLowerCase().includes(name.toLowerCase()));
        expect(leaked).toEqual([]);
      }
    }
  });

  it("yields an I-PII-DETECTED finding for review when a personal mention is detected outside the dictionary", () => {
    const { findings } = pseudonymizeTranscript(transcript, dictionary, { keepRoles: false });
    expect(findings).toEqual([
      {
        check: "I-PII-DETECTED",
        severity: "info",
        message:
          'personal mention "Firstname Lastname" in cue 4 at offset 0 is not in the pseudonymisation dictionary',
        remediation:
          "Add the name to pseudonyms.yaml, or edit the transcript in its source repository.",
      },
    ]);
  });

  it("reports one finding per distinct mention, whatever its case", () => {
    const { findings } = pseudonymizeTranscript(
      {
        cues: [
          { text: "Jane Roe and Firstname Lastname" },
          { text: "then FIRSTNAME Lastname" },
          { text: "and Firstname  Lastname again" },
        ],
        speakers: [],
      },
      dictionary,
      { keepRoles: false, locale: "en" },
    );
    expect(findings.map((finding) => finding.message)).toEqual([
      'personal mention "Jane Roe" in cue 1 at offset 0 is not in the pseudonymisation dictionary',
      'personal mention "Firstname Lastname" in cue 1 at offset 13 is not in the pseudonymisation dictionary',
    ]);
  });

  it("applies pseudonymisation before indexing: the text handed to any consumer carries no real name", () => {
    const { transcript: result } = pseudonymizeTranscript(transcript, dictionary, {
      keepRoles: false,
    });
    const indexed = result.cues.map((cue) => `${cue.speaker ?? ""}: ${cue.text}`).join("\n");
    for (const name of realNames) {
      expect(indexed.toLowerCase()).not.toContain(name.toLowerCase());
    }
    expect(indexed).toContain("Speaker-1: Yes. Participant-3 joins later.");
  });

  it("returns an empty transcript unchanged", () => {
    expect(
      pseudonymizeTranscript({ cues: [], speakers: [] }, dictionary, { keepRoles: false }),
    ).toEqual({ transcript: { cues: [], speakers: [] }, findings: [] });
  });
});
