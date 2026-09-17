import { describe, expect, it } from "vitest";

import { loadPseudonymDictionary } from "../../src/privacy/dictionary.js";
import {
  createSpeakerNumbering,
  detectPersonalMentions,
  pseudonymizeSpeaker,
  pseudonymizeText,
} from "../../src/privacy/pseudonymize.js";

const dictionary = loadPseudonymDictionary(`
version: 1
people:
  "Mary Ann": { pseudonym: Participant-2 }
  "Mary Ann Smith": { pseudonym: Participant-1, role: Project lead }
  "Élodie Dupont": { pseudonym: Participant-3, role: Analyst }
  "Bob": { pseudonym: Participant-4 }
  "Ann Smith": { pseudonym: Participant-5 }
  "  Carol Ray  ": { pseudonym: Participant-6 }
`);

describe("pseudonymizeText", () => {
  it("replaces every occurrence of a real name by its pseudonym and counts them", () => {
    expect(
      pseudonymizeText("Bob asked Élodie Dupont; Bob agreed.", dictionary, { keepRoles: false }),
    ).toEqual({ text: "Participant-4 asked Participant-3; Participant-4 agreed.", replaced: 3 });
  });

  it("leaves a text without any real name untouched", () => {
    expect(pseudonymizeText("Nothing to see here.", dictionary, { keepRoles: false })).toEqual({
      text: "Nothing to see here.",
      replaced: 0,
    });
  });

  it("keeps the role instead of the pseudonym when the configuration asks for it (keep_roles)", () => {
    expect(
      pseudonymizeText("Mary Ann Smith and Bob met Élodie Dupont.", dictionary, {
        keepRoles: true,
      }),
    ).toEqual({ text: "Project lead and Participant-4 met Analyst.", replaced: 3 });
  });

  it("matches real names case-insensitively and accent-insensitively", () => {
    expect(
      pseudonymizeText("MARY ANN SMITH, elodie DUPONT, bob", dictionary, { keepRoles: false }),
    ).toEqual({ text: "Participant-1, Participant-3, Participant-4", replaced: 3 });
  });

  it("matches the longest name first", () => {
    expect(
      pseudonymizeText("Mary Ann Smith met Mary Ann.", dictionary, { keepRoles: false }).text,
    ).toBe("Participant-1 met Participant-2.");
  });

  it("does not match a shorter name inside a longer match, and resumes right after it", () => {
    expect(pseudonymizeText("Mary Ann Smith Bob Bob", dictionary, { keepRoles: false })).toEqual({
      text: "Participant-1 Participant-4 Participant-4",
      replaced: 3,
    });
  });

  it("ignores the whitespace around a dictionary name", () => {
    expect(pseudonymizeText("Hi Carol Ray!", dictionary, { keepRoles: false }).text).toBe(
      "Hi Participant-6!",
    );
  });

  it("matches on word boundaries only", () => {
    expect(
      pseudonymizeText("Bobby met Mary Ann Smithson and Mary-Ann and d'Élodie Dupont", dictionary, {
        keepRoles: false,
      }).text,
    ).toBe("Bobby met Participant-2 Smithson and Mary-Ann and d'Participant-3");
  });

  it("reads any run of whitespace between the words of a name as one space", () => {
    expect(
      pseudonymizeText("Mary  Ann\tSmith arrived", dictionary, { keepRoles: false }).text,
    ).toBe("Participant-1 arrived");
  });

  it("cuts words according to the locale given", () => {
    expect(
      pseudonymizeText("l'avis d'Élodie Dupont", dictionary, { keepRoles: false, locale: "fr" }),
    ).toEqual({ text: "l'avis d'Participant-3", replaced: 1 });
  });
});

describe("pseudonymizeSpeaker", () => {
  it("takes the pseudonym of a speaker named in the dictionary, whatever the case and accents", () => {
    const options = { keepRoles: false, numbering: createSpeakerNumbering() };
    expect(pseudonymizeSpeaker("ELODIE DUPONT", dictionary, options)).toBe("Participant-3");
    expect(pseudonymizeSpeaker("Mary Ann Smith", dictionary, options)).toBe("Participant-1");
    expect(options.numbering.entries()).toEqual([]);
  });

  it("segments the names of the dictionary once per locale, not once per cue: a thousand lookups cost a thousand segmentations", () => {
    const people = Array.from(
      { length: 200 },
      (_, index) => `  "Person Number${String(index)}": { pseudonym: P-${String(index)} }`,
    );
    const many = loadPseudonymDictionary(`version: 1\npeople:\n${people.join("\n")}\n`);
    const Original = Intl.Segmenter;
    let constructed = 0;
    class Counting extends Original {
      constructor(...args: ConstructorParameters<typeof Intl.Segmenter>) {
        super(...args);
        constructed += 1;
      }
    }
    Object.defineProperty(Intl, "Segmenter", {
      value: Counting,
      configurable: true,
      writable: true,
    });
    try {
      const options = { keepRoles: false, numbering: createSpeakerNumbering("en"), locale: "en" };
      for (let cue = 0; cue < 500; cue += 1) {
        expect(pseudonymizeSpeaker(`person number${String(cue % 200)}`, many, options)).toBe(
          `P-${String(cue % 200)}`,
        );
      }
      // The 200 names once, then one segmentation per lookup; never 200 per lookup.
      expect(constructed).toBeLessThanOrEqual(200 + 500);
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        value: Original,
        configurable: true,
        writable: true,
      });
    }
  });

  it("numbers two spellings of one name once, by the key of the locale of the transcript", () => {
    const numbering = createSpeakerNumbering("fr");
    expect(numbering.pseudonymFor("Élodie Dupont")).toBe("Speaker-1");
    expect(numbering.pseudonymFor("ELODIE DUPONT")).toBe("Speaker-1");
    expect(numbering.pseudonymFor("Bob")).toBe("Speaker-2");
    expect(numbering.entries().map((entry) => entry.name)).toEqual(["Élodie Dupont", "Bob"]);
  });

  it("keeps the role of a speaker when the configuration asks for it (keep_roles)", () => {
    const options = { keepRoles: true, numbering: createSpeakerNumbering() };
    expect(pseudonymizeSpeaker("Mary Ann Smith", dictionary, options)).toBe("Project lead");
    expect(pseudonymizeSpeaker("Bob", dictionary, options)).toBe("Participant-4");
  });

  it("numbers a speaker outside the dictionary by first appearance, stably within the transcript", () => {
    const numbering = createSpeakerNumbering();
    const options = { keepRoles: false, numbering };
    expect(pseudonymizeSpeaker("Alice Lee", dictionary, options)).toBe("Speaker-1");
    expect(pseudonymizeSpeaker("Dan Poe", dictionary, options)).toBe("Speaker-2");
    expect(pseudonymizeSpeaker("alice  LEE", dictionary, options)).toBe("Speaker-1");
    expect(pseudonymizeSpeaker("Dan Poe", dictionary, { ...options, locale: "fr" })).toBe(
      "Speaker-2",
    );
    expect(numbering.entries()).toEqual([
      { name: "Alice Lee", pseudonym: "Speaker-1" },
      { name: "Dan Poe", pseudonym: "Speaker-2" },
    ]);
  });
});

describe("detectPersonalMentions", () => {
  it("detects a run of two or more capitalised words with its offset", () => {
    expect(
      detectPersonalMentions("Then Firstname Lastname spoke to John Mc Doe.", dictionary),
    ).toEqual([
      { text: "Then Firstname Lastname", offset: 0 },
      { text: "John Mc Doe", offset: 33 },
    ]);
  });

  it("ignores a mention covered by a dictionary name", () => {
    expect(detectPersonalMentions("Mary Ann Smith met Élodie Dupont.", dictionary)).toEqual([]);
    expect(detectPersonalMentions("Then Mary Ann Smith met Jane Roe", dictionary)).toEqual([
      { text: "Jane Roe", offset: 24 },
    ]);
  });

  it("excludes all-uppercase acronyms and single capitals", () => {
    expect(detectPersonalMentions("NASA Boss met A Person and the IT Team", dictionary)).toEqual(
      [],
    );
  });

  it("does not read a capital inside a word as a capitalised word", () => {
    expect(detectPersonalMentions("the iPhone Alice uses", dictionary)).toEqual([]);
  });

  it("reports a mention that precedes or follows a dictionary name", () => {
    expect(detectPersonalMentions("Jane Roe met Bob and Kim Lee", dictionary)).toEqual([
      { text: "Jane Roe", offset: 0 },
      { text: "Kim Lee", offset: 21 },
    ]);
  });

  it("keeps a run together across several spaces", () => {
    expect(detectPersonalMentions("Alice  Zed", dictionary)).toEqual([
      { text: "Alice  Zed", offset: 0 },
    ]);
  });

  it("ignores a single capitalised word", () => {
    expect(detectPersonalMentions("Yes. Alice agreed. Bob, too.", dictionary)).toEqual([]);
  });

  it("ends a run at a punctuation mark, a lowercase word or a line break", () => {
    expect(
      detectPersonalMentions(
        "Alice, Bob and Carol\nDave said Erin Frank (Gina Hall) came",
        dictionary,
      ),
    ).toEqual([
      { text: "Erin Frank", offset: 31 },
      { text: "Gina Hall", offset: 43 },
    ]);
  });

  it("cuts words according to the locale given", () => {
    expect(detectPersonalMentions("l'avis d'Alice Lee", dictionary, { locale: "fr" })).toEqual([
      { text: "Alice Lee", offset: 9 },
    ]);
  });
});
