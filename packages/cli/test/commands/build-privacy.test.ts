import { definePlugin, parseModel, type Reader } from "@concordance-wiki/core";
import vtt, { readTranscript } from "@concordance-wiki/plugin-reader-vtt";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";

const REAL_NAMES = ["Firstname Lastname", "Second Person", "Third Voice"];

const transcript = [
  "WEBVTT",
  "Language: en",
  "",
  "NOTE Recorded with Firstname Lastname in the room.",
  "",
  "00:00:04.000 --> 00:00:09.000",
  "<v Firstname Lastname>The keyword page threshold is three occurrences in two files.",
  "",
  "00:00:10.000 --> 00:00:14.000",
  "<v Second Person>Firstname Lastname agrees; Third Voice joins later.",
  "",
  "00:00:15.000 --> 00:00:18.000",
  "<v Third Voice>Please ask Unknown Someone about the build summary.",
  "",
].join("\n");

const minutes = [
  "---",
  "type: meeting",
  "date: 2026-03-12",
  "participants: [Firstname Lastname, Second Person]",
  "source: 2026-03-12-review.vtt",
  "---",
  "# Threshold review",
  "",
  "Firstname Lastname opened the session; Second Person wrote the build summary.",
  "",
].join("\n");

const dictionary = [
  "version: 1",
  "people:",
  '  "Firstname Lastname": { pseudonym: Participant-1, role: Maintainer }',
  '  "Second Person": { pseudonym: Participant-2 }',
  "",
].join("\n");

const deps = {
  load: () => Promise.resolve(vtt),
  commandAvailable: () => Promise.resolve(false),
};

function corpus(privacy: string, files: Record<string, string> = {}): RecordedIo {
  return recordedIo({
    "/work/concordance.yaml": `${validConfig}plugins: ["@concordance-wiki/plugin-reader-vtt"]\n${privacy}`,
    "/work/notes/2026-03-12-review.md": minutes,
    "/work/notes/2026-03-12-review.vtt": transcript,
    "/work/notes/glossary/threshold.md": "# Threshold\n\nThree occurrences in two files.\n",
    "/work/notes/untitled.md": "A note without a heading, hence without a title to ignore.\n",
    "/work/pseudonyms.yaml": dictionary,
    ...files,
  });
}

/** Every file the build wrote under the output, text decoded, by path. */
/** The text of a page as a reader sees it: the marks of the text and their hidden explanations removed. */
function visibleText(html: string): string {
  return html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");
}

function output(io: RecordedIo): Map<string, string> {
  const written = new Map<string, string>();
  for (const path of io.fs.listFiles("/work/dist")) {
    written.set(path, new TextDecoder().decode(io.fs.readBytes(`/work/dist/${path}`)));
  }
  return written;
}

describe("concordance build with pseudonymisation", () => {
  it("replaces every real name of the dictionary before the model, the fragments, the index and the download see the corpus", async () => {
    const io = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml } }\n",
    );
    expect(await buildCommand([], io, deps)).toBe(0);
    const written = output(io);
    expect(written.size).toBeGreaterThan(10);
    for (const [path, text] of written) {
      for (const name of REAL_NAMES.slice(0, 2)) {
        expect(`${path}: ${text}`).not.toContain(name);
      }
    }
    // The transcript offered for download is the rewritten one, timecodes kept, comment dropped.
    const page = "notes/2026-03-12-review";
    const download = written.get(`${page}/2026-03-12-review.vtt`);
    expect(download).toBe(
      [
        "WEBVTT",
        "Language: en",
        "",
        "00:00:04.000 --> 00:00:09.000",
        "<v Participant-1>The keyword page threshold is three occurrences in two files.",
        "",
        "00:00:10.000 --> 00:00:14.000",
        "<v Participant-2>Participant-1 agrees; Speaker-1 joins later.",
        "",
        "00:00:15.000 --> 00:00:18.000",
        "<v Speaker-1>Please ask Unknown Someone about the build summary.",
        "",
      ].join("\n"),
    );
    // The meeting note carries the pseudonyms in its attributes and its text.
    const model = parseModel(io.fs.readText("/work/dist/model.json"), "model.json");
    const meeting = model.entities.find((entity) => entity.id === page);
    expect(meeting?.attributes["participants"]).toEqual(["Participant-1", "Participant-2"]);
    expect(visibleText(io.fs.readText(`/work/dist/${page}/index.html`))).toContain(
      "Participant-1 opened the session; Participant-2 wrote the build summary.",
    );
    // The mention outside the dictionary is reported for review, the note titles are not.
    expect(model.findings.filter((finding) => finding.check === "I-PII-DETECTED")).toEqual([
      {
        check: "I-PII-DETECTED",
        severity: "info",
        source: "notes",
        path: "2026-03-12-review.vtt",
        message:
          'personal mention "Unknown Someone" in cue 3 at offset 11 is not in the pseudonymisation dictionary',
        remediation:
          "Add the name to pseudonyms.yaml, or edit the transcript in its source repository.",
      },
    ]);
  });

  it("never proposes a real name of the dictionary as a keyword page, even from notes outside the scope", async () => {
    const io = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml } }\n",
      {
        "/work/notes/roadmap.md":
          "# Roadmap\n\nSecond Person owns the roadmap. Second Person reviews it.\n",
        "/work/notes/release.md": "# Release\n\nSecond Person cuts the release.\n",
      },
    );
    expect(await buildCommand([], io, deps)).toBe(0);
    const model = parseModel(io.fs.readText("/work/dist/model.json"), "model.json");
    const keywords = model.entities.filter((entity) => entity.keyword === true);
    expect(keywords.map((entity) => entity.id)).not.toContain("keywords/second-person");
    expect(model.candidates.terms.map((term) => term.text)).not.toContain("Second Person");
    // A note outside the scope is published as written: the scope is the configuration's choice.
    expect(visibleText(io.fs.readText("/work/dist/notes/roadmap/index.html"))).toContain(
      "Second Person owns",
    );
  });

  it("keeps the roles instead of the pseudonyms when keep_roles is set", async () => {
    const io = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml, keep_roles: true } }\n",
    );
    expect(await buildCommand([], io, deps)).toBe(0);
    expect(io.fs.readText("/work/dist/notes/2026-03-12-review/2026-03-12-review.vtt")).toContain(
      "<v Maintainer>The keyword page threshold",
    );
  });

  it("fails the build with an error finding when pseudonymisation is enabled and the dictionary is unusable, and writes no transcript", async () => {
    const missing = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./absent.yaml } }\n",
    );
    expect(await buildCommand([], missing, deps)).toBe(1);
    expect(missing.stderr).toContain(
      "error: W-PRIVACY-DICTIONARY (./absent.yaml): pseudonymisation dictionary ./absent.yaml not found",
    );
    expect(missing.fs.exists("/work/dist/notes/2026-03-12-review/2026-03-12-review.vtt")).toBe(
      false,
    );
    const malformed = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml } }\n",
      { "/work/pseudonyms.yaml": "version: 1\npeople:\n  A B: Participant-1\n" },
    );
    expect(await buildCommand([], malformed, deps)).toBe(1);
    expect(malformed.stderr).toContain(
      'error: W-PRIVACY-DICTIONARY (./pseudonyms.yaml): error: ./pseudonyms.yaml: people["A B"]: wrong type; received "Participant-1"; expected object',
    );
    expect(malformed.stderr.at(-1)).toBe("build failed: 1 error finding(s)");
    for (const [path, text] of output(malformed)) {
      expect(`${path}: ${text}`).not.toContain("Third Voice");
    }
  });

  it("only warns about an unusable dictionary when pseudonymisation is disabled, and publishes nothing pseudonymised", async () => {
    const io = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: false, dictionary: ./absent.yaml } }\n",
    );
    expect(await buildCommand([], io, deps)).toBe(0);
    expect(io.stderr).toContain(
      "warning: W-PRIVACY-DICTIONARY (./absent.yaml): pseudonymisation dictionary ./absent.yaml not found",
    );
    expect(io.fs.readText("/work/dist/notes/2026-03-12-review/2026-03-12-review.vtt")).toBe(
      transcript,
    );
  });

  it("reads a transcript without publishing it when publish_transcripts is unset: no page text, no download, no index entry", async () => {
    const io = corpus("");
    expect(await buildCommand([], io, deps)).toBe(0);
    const page = "notes/2026-03-12-review";
    expect(io.fs.exists(`/work/dist/${page}/2026-03-12-review.vtt`)).toBe(false);
    for (const [path, text] of output(io)) {
      if (path.endsWith("model.json")) continue;
      expect(`${path}: ${text}`).not.toContain("Third Voice");
    }
    const model = parseModel(io.fs.readText("/work/dist/model.json"), "model.json");
    const transcriptEntity = model.entities.find((entity) => entity.source.path.endsWith(".vtt"));
    expect(transcriptEntity?.attributes["speakers"]).toBeUndefined();
  });

  it("withholds a transcript whose reader cannot rewrite it, with a warning", async () => {
    const reader: Reader = { extensions: [".vtt"], read: readTranscript };
    const plugin = definePlugin({
      name: "example-transcripts",
      version: "1.0.0",
      apiVersion: "1",
      contributes: { readers: [reader] },
    });
    const io = corpus(
      "privacy: { publish_transcripts: true, pseudonymize: { enabled: true, dictionary: ./pseudonyms.yaml } }\n",
    );
    expect(await buildCommand([], io, { ...deps, load: () => Promise.resolve(plugin) })).toBe(0);
    expect(io.stderr).toContain(
      "warning: W-PRIVACY-WITHHELD (notes:2026-03-12-review.vtt): 2026-03-12-review.vtt is not published: its reader cannot rewrite it with the pseudonyms",
    );
    expect(io.fs.exists("/work/dist/notes/2026-03-12-review/2026-03-12-review.vtt")).toBe(false);
    for (const [path, text] of output(io)) {
      expect(`${path}: ${text}`).not.toContain("Firstname Lastname");
    }
  });
});
