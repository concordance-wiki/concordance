import { describe, expect, it } from "vitest";

import {
  loadPseudonymDictionary,
  nameKey,
  parsePseudonymDictionary,
} from "../../src/privacy/dictionary.js";

const dictionary = `
version: 1
people:
  "Mary Ann": { pseudonym: Participant-2 }
  "Mary Ann Smith": { pseudonym: Participant-1, role: Project lead }
  "Élodie Dupont": { pseudonym: Participant-3 }
`;

describe("loadPseudonymDictionary", () => {
  it("reads every person with its pseudonym and optional role", () => {
    const loaded = loadPseudonymDictionary(dictionary);
    expect(loaded.people).toStrictEqual([
      { name: "Mary Ann Smith", pseudonym: "Participant-1", role: "Project lead" },
      { name: "Élodie Dupont", pseudonym: "Participant-3" },
      { name: "Mary Ann", pseudonym: "Participant-2" },
    ]);
  });

  it("orders people longest real name first, then by name", () => {
    const loaded = loadPseudonymDictionary(dictionary);
    expect(loaded.people.map((person) => person.name)).toEqual([
      "Mary Ann Smith",
      "Élodie Dupont",
      "Mary Ann",
    ]);
    const tie = loadPseudonymDictionary(
      "version: 1\npeople:\n  Zoe Li: { pseudonym: P-1 }\n  Ann Wu: { pseudonym: P-2 }\n  Max Po: { pseudonym: P-3 }\n",
    );
    expect(tie.people.map((person) => person.name)).toEqual(["Ann Wu", "Max Po", "Zoe Li"]);
  });

  it("measures the length of a name without its accents", () => {
    const loaded = loadPseudonymDictionary(
      "version: 1\npeople:\n  Éa Bé: { pseudonym: P-1 }\n  Ab Cd: { pseudonym: P-2 }\n",
    );
    expect(loaded.people.map((person) => person.name)).toEqual(["Ab Cd", "Éa Bé"]);
  });

  it("rejects text that is not valid YAML with the configuration wording", () => {
    expect(() => loadPseudonymDictionary("version: [\n")).toThrow(
      "error: pseudonyms.yaml: not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:",
    );
  });

  it("parses without throwing: the dictionary of a valid file, the issues of an invalid one", () => {
    expect(parsePseudonymDictionary("version: 1\npeople: { Ab Cd: { pseudonym: P } }\n")).toEqual({
      ok: true,
      dictionary: { people: [{ name: "Ab Cd", pseudonym: "P" }] },
    });
    expect(parsePseudonymDictionary("version: [\n")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "",
          message:
            "not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:",
        },
      ],
    });
    expect(parsePseudonymDictionary("version: 2\npeople: {}\n")).toMatchObject({
      ok: false,
      issues: [{ severity: "error", path: "version" }],
    });
    expect(
      parsePseudonymDictionary(
        "version: 1\npeople: { A B: { pseudonym: P }, a b: { pseudonym: Q } }\n",
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ severity: "error", path: 'people["a b"]' }],
    });
  });

  it("lists every schema issue, formatted like the configuration ones", () => {
    expect(() =>
      loadPseudonymDictionary(
        "version: 2\npeople:\n  A: {}\n  B: 1\n  C: { pseudonym: x, extra: 1 }\n",
      ),
    ).toThrow(
      [
        "error: pseudonyms.yaml: version: value is not allowed; received 2; expected 1",
        "error: pseudonyms.yaml: people.A.pseudonym: required key is missing",
        "error: pseudonyms.yaml: people.B: wrong type; received 1; expected object",
        "error: pseudonyms.yaml: people.C.extra: unknown key; expected one of the documented keys",
      ].join("\n"),
    );
  });

  it("names the file given in the messages", () => {
    expect(() => loadPseudonymDictionary("people: {}\n", "config/names.yaml")).toThrow(
      "error: config/names.yaml: version: required key is missing",
    );
  });

  it("rejects a real name without a word and a name declared twice up to case and accents", () => {
    expect(() =>
      loadPseudonymDictionary(
        'version: 1\npeople:\n  "  ": { pseudonym: P-0 }\n  "alice smith": { pseudonym: P-1 }\n  "Alice  SMITH": { pseudonym: P-2 }\n  "Álice Smith": { pseudonym: P-3 }\n',
      ),
    ).toThrow(
      [
        'error: pseudonyms.yaml: people["  "]: real name has no word; received "  "',
        'error: pseudonyms.yaml: people["Alice  SMITH"]: real name is already declared as "alice smith"; received "Alice  SMITH"; expected one entry per person, whatever the case and accents',
        'error: pseudonyms.yaml: people["Álice Smith"]: real name is already declared as "alice smith"; received "Álice Smith"; expected one entry per person, whatever the case and accents',
      ].join("\n"),
    );
  });
});

describe("nameKey", () => {
  it("folds case, accents and whitespace runs", () => {
    expect(nameKey("  Élodie   DUPONT ")).toBe("elodie dupont");
    expect(nameKey("Jean-Pierre", "fr")).toBe("jean-pierre");
  });
});
