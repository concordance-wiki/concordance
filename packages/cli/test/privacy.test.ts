import {
  memoryFileSystem,
  parseConfig,
  type Config,
  type Entity,
  type Reader,
} from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import type { ReadDocument } from "../src/pipeline/documents.js";
import { parseSources } from "../src/pipeline/parse.js";
import {
  loadPseudonymization,
  pseudonymizeScope,
  pseudonymizeTranscripts,
  type Pseudonymization,
} from "../src/pipeline/privacy.js";

const dictionary = [
  "version: 1",
  "people:",
  '  "Firstname Lastname": { pseudonym: Participant-1, role: Maintainer }',
  '  "Second Person": { pseudonym: Participant-2 }',
  "",
].join("\n");

function config(privacy: string): Config {
  const parsed = parseConfig(
    [
      "version: 1",
      "project: { name: Wiki, locale: fr }",
      "sources: [{ name: notes, path: ./notes }]",
      privacy,
      "",
    ].join("\n"),
  );
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  return parsed.config;
}

const fs = memoryFileSystem({
  "/work/pseudonyms.yaml": dictionary,
  "/work/broken.yaml": "version: 1\npeople: []\n",
  "/work/notes/review.md": "---\ntype: meeting\n---\n# Review\n\nFirstname Lastname spoke.\n",
  "/work/notes/plain.md": "# Plain\n\nFirstname Lastname wrote this too.\n",
  "/work/notes/review.vtt": "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Firstname Lastname>Hi\n",
});

const source: IngestedSource = {
  name: "notes",
  root: "/work/notes",
  locale: "en",
  files: [
    {
      path: "review.md",
      absolutePath: "/work/notes/review.md",
      modifiedAt: "2026-01-01T00:00:00Z",
    },
    { path: "plain.md", absolutePath: "/work/notes/plain.md", modifiedAt: "2026-01-01T00:00:00Z" },
    {
      path: "review.vtt",
      absolutePath: "/work/notes/review.vtt",
      modifiedAt: "2026-01-01T00:00:00Z",
    },
  ],
};

function document(path: string, extra: Partial<ReadDocument> = {}): ReadDocument {
  return {
    source: "notes",
    path,
    absolutePath: `/work/notes/${path}`,
    format: path.slice(path.lastIndexOf(".") + 1),
    size: 1,
    metadata: {},
    unit: "page",
    pages: [],
    ...extra,
  };
}

const transcript = document("review.vtt", {
  unit: "cue",
  metadata: { speakers: ["Firstname Lastname", "Third Voice"], title: "Firstname Lastname talks" },
  pages: [
    { number: 1, label: "00:00:01", text: "Hi Second Person", speaker: "Firstname Lastname" },
    { number: 2, label: "00:00:03", text: "Hello Firstname Lastname", speaker: "Third Voice" },
  ],
});

const reader: Reader = {
  extensions: [".VTT"],
  read: () => ({ metadata: {}, text: "" }),
  rewrite: (input, substitution) =>
    new TextEncoder().encode(
      `${input.path}: ${substitution.speaker("Third Voice")} ${substitution.text("Hi Second Person")}`,
    ),
};

/** The pseudonymisation of `enabled()` without its dictionary, as an unusable file leaves it. */
function withoutDictionary(overrides: Partial<Pseudonymization> = {}): Pseudonymization {
  const loaded = enabled();
  delete loaded.dictionary;
  return { ...loaded, ...overrides };
}

function enabled(extra = ""): Pseudonymization {
  return loadPseudonymization({
    config: config(
      `privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml${extra} } }`,
    ),
    configDirectory: "/work",
    fs,
  });
}

describe("loadPseudonymization", () => {
  it("reads the dictionary relative to the configuration, with the options and the default scope", () => {
    const loaded = enabled(", keep_roles: true");
    expect(loaded).toEqual({
      enabled: true,
      dictionary: {
        people: [
          { name: "Firstname Lastname", pseudonym: "Participant-1", role: "Maintainer" },
          { name: "Second Person", pseudonym: "Participant-2" },
        ],
      },
      options: { keepRoles: true, locale: "fr" },
      scope: new Set(["meeting"]),
      names: ["Firstname Lastname", "Second Person"],
      findings: [],
    });
  });

  it("keeps the names but not the dictionary when pseudonymisation is disabled, and reads the declared scope", () => {
    const loaded = loadPseudonymization({
      config: config(
        "privacy: { pseudonymize: { enabled: false, dictionary: ./pseudonyms.yaml, scope: [meeting, decision] } }",
      ),
      configDirectory: "/work",
      fs,
    });
    expect(loaded.dictionary).toBeUndefined();
    expect(loaded.names).toEqual(["Firstname Lastname", "Second Person"]);
    expect(loaded.scope).toEqual(new Set(["meeting", "decision"]));
    expect(loaded.options).toEqual({ keepRoles: false, locale: "fr" });
  });

  it("does nothing without a privacy block, and uses the en locale when the project sets none", () => {
    const parsed = parseConfig(
      "version: 1\nproject: { name: W }\nsources: [{ name: n, path: ./n }]\n",
    );
    expect(parsed.ok).toBe(true);
    const loaded = loadPseudonymization({
      config: parsed.ok ? parsed.config : config(""),
      configDirectory: "/work",
      fs,
    });
    expect(loaded).toEqual({
      enabled: false,
      options: { keepRoles: false, locale: "en" },
      scope: new Set(["meeting"]),
      names: [],
      findings: [],
    });
  });

  it("reports a missing dictionary as a warning when disabled and as an error when enabled", () => {
    const disabled = loadPseudonymization({
      config: config("privacy: { pseudonymize: { enabled: false, dictionary: ./absent.yaml } }"),
      configDirectory: "/work",
      fs,
    });
    expect(disabled.findings).toEqual([
      {
        check: "W-PRIVACY-DICTIONARY",
        severity: "warning",
        path: "./absent.yaml",
        message: "pseudonymisation dictionary ./absent.yaml not found",
        remediation:
          "Fix the path of privacy.pseudonymize.dictionary, or the file it names, one entry per real name with a pseudonym.",
      },
    ]);
    const missing = loadPseudonymization({
      config: config("privacy: { pseudonymize: { enabled: true, dictionary: ./absent.yaml } }"),
      configDirectory: "/work",
      fs,
    });
    expect(missing.findings.map((finding) => finding.severity)).toEqual(["error"]);
    expect(missing.dictionary).toBeUndefined();
  });

  it("reports every issue of a malformed dictionary in one finding", () => {
    const loaded = loadPseudonymization({
      config: config("privacy: { pseudonymize: { enabled: true, dictionary: ./broken.yaml } }"),
      configDirectory: "/work",
      fs,
    });
    expect(loaded.findings).toMatchObject([
      {
        check: "W-PRIVACY-DICTIONARY",
        severity: "error",
        path: "./broken.yaml",
        message: "error: ./broken.yaml: people: wrong type; received []; expected object",
      },
    ]);
    expect(loaded.names).toEqual([]);
  });
});

describe("pseudonymizeTranscripts", () => {
  it("replaces the speakers and texts of the cues, the metadata and the downloaded file with one substitution", () => {
    const { documents, findings } = pseudonymizeTranscripts({
      documents: [
        document("deck.pptx", {
          pages: [{ number: 1, label: "slide 1", text: "Firstname Lastname" }],
        }),
        transcript,
      ],
      readers: [reader],
      config: config("privacy: { publish_transcripts: true }"),
      pseudonymization: enabled(),
      titles: [],
      fs,
    });
    expect(documents[0]).toEqual(
      document("deck.pptx", {
        pages: [{ number: 1, label: "slide 1", text: "Firstname Lastname" }],
      }),
    );
    expect(documents[1]).toEqual({
      ...transcript,
      metadata: { speakers: ["Participant-1", "Speaker-1"], title: "Participant-1 talks" },
      pages: [
        { number: 1, label: "00:00:01", text: "Hi Participant-2", speaker: "Participant-1" },
        { number: 2, label: "00:00:03", text: "Hello Participant-1", speaker: "Speaker-1" },
      ],
      download: {
        kind: "rewritten",
        bytes: new TextEncoder().encode("review.vtt: Speaker-1 Hi Participant-2"),
      },
    });
    expect(findings).toEqual([]);
  });

  it("locates the mentions outside the dictionary on the transcript, and ignores the titles of the notes", () => {
    const withMention = {
      ...transcript,
      pages: [{ number: 1, label: "00:00:01", text: "We meet Fourth Voice at Keyword Page" }],
    };
    const { findings } = pseudonymizeTranscripts({
      documents: [withMention],
      readers: [reader],
      config: config("privacy: { publish_transcripts: true }"),
      pseudonymization: enabled(),
      titles: ["Keyword page"],
      fs,
    });
    expect(findings).toMatchObject([
      {
        check: "I-PII-DETECTED",
        source: "notes",
        path: "review.vtt",
        message:
          'personal mention "Fourth Voice" in cue 1 at offset 8 is not in the pseudonymisation dictionary',
      },
    ]);
  });

  it("withholds a transcript when no reader rewrites its format, and says so", () => {
    const { documents, findings } = pseudonymizeTranscripts({
      documents: [transcript],
      readers: [
        { extensions: [".vtt"], read: reader.read },
        { ...reader, extensions: [".srt"] },
      ],
      config: config("privacy: { publish_transcripts: true }"),
      pseudonymization: enabled(),
      titles: [],
      fs,
    });
    expect(documents).toEqual([
      { ...transcript, metadata: {}, pages: [], download: { kind: "withheld" } },
    ]);
    expect(findings).toEqual([
      {
        check: "W-PRIVACY-WITHHELD",
        severity: "warning",
        source: "notes",
        path: "review.vtt",
        message: "review.vtt is not published: its reader cannot rewrite it with the pseudonyms",
        remediation:
          "Use a reader that implements rewrite for the format, or publish the transcript through a format the built-in reader handles.",
      },
    ]);
  });

  it("withholds every transcript when transcripts are not published, or when pseudonymisation is enabled without a usable dictionary", () => {
    const unpublished = pseudonymizeTranscripts({
      documents: [transcript],
      readers: [reader],
      config: config("privacy: { publish_transcripts: false }"),
      pseudonymization: enabled(),
      titles: [],
      fs,
    });
    expect(unpublished.documents[0]?.download).toEqual({ kind: "withheld" });
    expect(unpublished.documents[0]?.pages).toEqual([]);
    const broken = pseudonymizeTranscripts({
      documents: [transcript],
      readers: [reader],
      config: config("privacy: { publish_transcripts: true }"),
      pseudonymization: withoutDictionary(),
      titles: [],
      fs,
    });
    expect(broken.documents[0]?.download).toEqual({ kind: "withheld" });
  });

  it("leaves a published transcript as written when pseudonymisation is disabled", () => {
    const { documents, findings } = pseudonymizeTranscripts({
      documents: [transcript],
      readers: [reader],
      config: config("privacy: { publish_transcripts: true }"),
      pseudonymization: withoutDictionary({ enabled: false }),
      titles: [],
      fs,
    });
    expect(documents).toEqual([transcript]);
    expect(findings).toEqual([]);
  });
});

describe("pseudonymizeScope", () => {
  const parsed = parseSources([source], fs);
  const entity = (path: string, type: string, extra: Partial<Entity> = {}): Entity => ({
    id: `notes/${path.replace(/\.[^.]+$/, "")}`,
    type,
    title: path === "review.md" ? "Review by Firstname Lastname" : "Plain",
    aliases: ["Second Person"],
    locale: "en",
    status: "active",
    type_origin: "frontmatter",
    graph: "full",
    attributes: { participants: ["Firstname Lastname"] },
    source: { name: "notes", path, line: 1 },
    ...extra,
  });
  const deck = document("deck.pptx", {
    metadata: { author: "Second Person" },
    pages: [{ number: 1, label: "slide 1", text: "Firstname Lastname presents" }],
  });

  it("rewrites the notes, the documents and the entities of the scope, and leaves the rest alone", () => {
    const scoped = pseudonymizeScope({
      entities: [
        entity("review.md", "meeting", { summary: "Firstname Lastname spoke." }),
        entity("plain.md", "document"),
        entity("deck.pptx", "meeting"),
        entity("review.vtt", "meeting"),
      ],
      documents: parsed.documents,
      resources: [deck, transcript],
      sources: [source],
      pseudonymization: enabled(),
      fs,
    });
    expect(scoped.notes).toEqual(
      new Map([["notes/review.md", "---\ntype: meeting\n---\n# Review\n\nParticipant-1 spoke.\n"]]),
    );
    const review = scoped.documents.find((note) => note.path === "review.md");
    expect(review?.document.paragraphs[0]?.text).toBe("Participant-1 spoke.");
    const plain = scoped.documents.find((note) => note.path === "plain.md");
    expect(plain?.document.paragraphs[0]?.text).toBe("Firstname Lastname wrote this too.");
    expect(scoped.resources).toEqual([
      {
        ...deck,
        metadata: { author: "Participant-2" },
        pages: [{ number: 1, label: "slide 1", text: "Participant-1 presents" }],
      },
      transcript,
    ]);
    expect(scoped.entities[0]).toMatchObject({
      title: "Review by Participant-1",
      aliases: ["Participant-2"],
      summary: "Participant-1 spoke.",
      attributes: { participants: ["Participant-1"] },
    });
    expect(scoped.entities[1]).toEqual(entity("plain.md", "document"));
    expect(scoped.entities[3]).toMatchObject({ title: "Plain", aliases: ["Participant-2"] });
  });

  it("keeps a note of the scope as parsed when it names nobody, and skips a file the sources do not list", () => {
    const scoped = pseudonymizeScope({
      entities: [entity("review.md", "meeting"), entity("plain.md", "meeting")],
      documents: [
        ...parsed.documents,
        {
          source: "notes",
          path: "ghost.md",
          document: parsed.documents[0]?.document ?? {
            frontmatter: {},
            title: undefined,
            sections: [],
            links: [],
            images: [],
            codeBlocks: [],
            quotes: [],
            tables: [],
            paragraphs: [],
            scannable: [],
            findings: [],
          },
        },
      ],
      resources: [],
      sources: [source],
      pseudonymization: {
        ...enabled(),
        dictionary: { people: [{ name: "Nobody Here", pseudonym: "P" }] },
      },
      fs,
    });
    expect(scoped.notes.size).toBe(0);
    expect(scoped.documents).toHaveLength(parsed.documents.length + 1);
  });

  it("changes nothing without a dictionary", () => {
    const entities = [entity("review.md", "meeting")];
    const scoped = pseudonymizeScope({
      entities,
      documents: parsed.documents,
      resources: [deck],
      sources: [source],
      pseudonymization: withoutDictionary(),
      fs,
    });
    expect(scoped).toEqual({
      entities,
      documents: parsed.documents,
      resources: [deck],
      notes: new Map(),
    });
  });
});
