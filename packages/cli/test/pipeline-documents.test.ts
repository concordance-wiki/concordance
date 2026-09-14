import { catalogue, createRegistry } from "@concordance-wiki/checks";
import {
  fixedClock,
  memoryFileSystem,
  parseConfig,
  type Config,
  type Converter,
  type PluginRegistry,
  type Reader,
} from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import {
  createConverter,
  createPdfConverter,
  extractPdfPages,
  type CommandRunner,
} from "@concordance-wiki/plugin-convert-libreoffice";
import officeReader from "@concordance-wiki/plugin-reader-office";
import vttReader from "@concordance-wiki/plugin-reader-vtt";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { parseFragment } from "@concordance-wiki/site";
import { describe, expect, it } from "vitest";

import { buildDictionaries, corpusStopwords } from "../src/pipeline/dictionary.js";
import { fragmentsOf, writeFragments } from "../src/pipeline/fragments.js";
import { parseSources } from "../src/pipeline/parse.js";
import { runPipeline, type PipelineInput, type PipelineResult } from "../src/pipeline/run.js";
import { scanNotes } from "../src/pipeline/scan.js";
import { FakeGit, tinyPdf } from "./helpers.js";

const profile = loadDefaultProfile();
const clock = fixedClock("2026-09-12T12:00:00Z");
const cacheDirectory = "/work/.concordance-cache";

const configText = [
  "version: 1",
  "project: { name: Concordance wiki }",
  "applications: [{ id: concordance-cli }]",
  "domains: [{ id: publication, match: ['**/*'] }]",
  // The transcripts of the corpus are published, as the tests of their text expect.
  "privacy: { publish_transcripts: true }",
  "sources:",
  "  - name: specs",
  "    path: ./specs",
  "    application: concordance-cli",
  "    rules:",
  "      - { match: { path: 'glossary/**' }, set: { type: term } }",
  "      - { match: { ext: ['.vtt'] }, set: { type: meeting } }",
  "",
].join("\n");

function parsedConfig(text: string): Config {
  const parsed = parseConfig(text);
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  return parsed.config;
}

/** The PDF the fake LibreOffice writes for every office document: two slides about the threshold. */
const DECK_PDF = tinyPdf([
  "The publication threshold on slide one",
  "Build summary of the workshop",
]);

/** Plays LibreOffice: writes the deck PDF where `--outdir` says, or fails when told to. */
function fakeSoffice(fs: ReturnType<typeof memoryFileSystem>, failing = false): CommandRunner {
  return {
    run: (_command, args) => {
      if (failing) {
        return Promise.resolve({ code: 1, stdout: "", stderr: "cannot open", timedOut: false });
      }
      const outdir = args[args.indexOf("--outdir") + 1] ?? "";
      const input = args[args.length - 1] ?? "";
      const name = input.slice(input.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
      fs.writeBytes(`${outdir}/${name}.pdf`, DECK_PDF);
      return Promise.resolve({ code: 0, stdout: "", stderr: "", timedOut: false });
    },
  };
}

/** A deck reader whose text must never reach the model: the text of a deck comes from its PDF. */
const deckReader: Reader = {
  extensions: [".pptx"],
  read: () => ({
    metadata: { title: "Threshold review", slides: 2 },
    text: "READER TEXT that the single extraction path must never index",
  }),
};

function registryWith(readers: Reader[], converters: Converter[]): PluginRegistry {
  return {
    plugins: () => [],
    registrations: () => [],
    readers: () => readers,
    converters: () => converters,
    sources: () => [],
    inferenceMethods: () => [],
    checks: () => [],
    projections: () => [],
    uiComponents: () => [],
    themes: () => [],
    types: () => [],
  };
}

const vtt = [
  "WEBVTT",
  "",
  "00:00:04.000 --> 00:00:09.000",
  "<v Participant-1>The publication threshold stays at three occurrences.",
  "",
  "00:01:10.000 --> 00:01:15.000",
  "<v Participant-2>The build summary will say so.",
  "",
].join("\n");

const corpusFiles: Record<string, string | Uint8Array> = {
  "/work/concordance.yaml": configText,
  "/work/specs/glossary/publication-threshold.md":
    "# Publication threshold\n\nThree occurrences in two files make a keyword page.\n",
  "/work/specs/meetings/threshold-review.md":
    "# Threshold review\n\nNotes of the workshop about the publication threshold.\n\nThe build summary lists the workshop.\n",
  "/work/specs/meetings/threshold-review.pptx": "PK fake deck",
  "/work/specs/meetings/neighbourhood-cap.vtt": vtt,
  "/work/specs/framing/vision.pdf": tinyPdf([
    "The publication threshold is three occurrences in two files",
    "Vision of the tool",
  ]),
  "/work/specs/framing/diagram.png": "png bytes",
};

interface Built {
  input: PipelineInput;
  result: PipelineResult;
  fs: ReturnType<typeof memoryFileSystem>;
}

async function build(
  options: { failing?: boolean; files?: Record<string, string | Uint8Array> } = {},
): Promise<Built> {
  const fs = memoryFileSystem();
  for (const [path, content] of Object.entries({ ...corpusFiles, ...options.files })) {
    if (typeof content === "string") fs.writeText(path, content);
    else fs.writeBytes(path, content);
  }
  const config = parsedConfig(configText);
  const ingested = await ingestSources(config, {
    fs,
    git: new FakeGit(fs),
    configDirectory: "/work",
    cacheDirectory,
  });
  const deps = { runner: fakeSoffice(fs, options.failing), fs, extractPages: extractPdfPages };
  const input: PipelineInput = {
    config,
    profile,
    configDirectory: "/work",
    cacheDirectory,
    sources: ingested.sources,
    findings: ingested.findings,
    plugins: registryWith(
      [
        deckReader,
        ...(vttReader.contributes.readers ?? []),
        ...(officeReader.contributes.readers ?? []),
      ],
      [createConverter(deps), createPdfConverter(deps)],
    ),
    checks: createRegistry(catalogue),
    fs,
    clock,
    parallelism: 2,
  };
  return { input, result: await runPipeline(input), fs };
}

const THRESHOLD = "specs/glossary/publication-threshold";
const REVIEW = "specs/meetings/threshold-review";
const VISION = "specs/framing/vision.pdf";
const TRANSCRIPT = "specs/meetings/neighbourhood-cap.vtt";

describe("L4-07 extracted text indexed", () => {
  it("extracts the text from the converted PDF, not from the original format, so that there is a single extraction path", async () => {
    const { result, input } = await build();
    const [review] = fragmentsOf({
      entities: result.entities.filter((entity) => entity.id === REVIEW),
      sources: input.sources,
      keywordMentions: result.keywordMentions,
      recognised: result.recognised,
      documents: result.documents,
      config: input.config,
      fs: input.fs,
    });
    expect(
      review?.documents?.map((document) => [document.path, document.format, document.unit]),
    ).toEqual([["meetings/threshold-review.pptx", "pptx", "slide"]]);
    expect(review?.documents?.[0]?.pages).toEqual([
      { number: 1, label: "slide 1", text: "The publication threshold on slide one" },
      { number: 2, label: "slide 2", text: "Build summary of the workshop" },
    ]);
    const vision = result.documents.find((document) => document.path === "framing/vision.pdf");
    expect(vision?.pages.map((page) => page.text)).toEqual([
      "The publication threshold is three occurrences in two files",
      "Vision of the tool",
    ]);
    expect(vision?.metadata).toEqual({ pages: 2 });
    expect(JSON.stringify(result)).not.toContain("READER TEXT");
    expect(JSON.stringify(review)).not.toContain("READER TEXT");
    // The deck keeps the metadata of its reader all the same.
    expect(result.entities.find((entity) => entity.id === REVIEW)?.representations).toEqual([
      { path: "meetings/threshold-review.md", format: "markdown" },
      { path: "meetings/threshold-review.pptx", format: "pptx" },
    ]);
  });

  it("feeds the extracted text to the search index, term recognition and similarity computation", async () => {
    const { result, input } = await build();
    // Recognition: the glossary term is found in the deck, the PDF and the transcript.
    const mentions = result.links
      .filter((link) => link.to === THRESHOLD || link.from === THRESHOLD)
      .flatMap((link) =>
        link.provenance
          .filter((provenance) => provenance.method === "glossary_occurrence")
          .map(
            (provenance) =>
              `${link.from === THRESHOLD ? link.to : link.from} ${provenance.path ?? ""}`,
          ),
      );
    expect(mentions).toEqual([
      `${VISION} framing/vision.pdf`,
      `${TRANSCRIPT} meetings/neighbourhood-cap.vtt`,
      `${REVIEW} meetings/threshold-review.md`,
      `${REVIEW} meetings/threshold-review.pptx`,
    ]);
    // Similarity: the deck shares its base name and its title with the note, so they merge.
    expect(result.entities.map((entity) => entity.id)).not.toContain(`${REVIEW}.pptx`);
    expect(result.entities.find((entity) => entity.id === REVIEW)?.grouped_by).toBe(
      "same base name",
    );
    expect(result.candidates.duplicates).toEqual([
      {
        resources: [REVIEW, `${REVIEW}.pptx`],
        score: 1,
        signals: ["same_name", "same_title", "same_directory"],
      },
    ]);
    expect(result.duplicates).toMatchObject({ resources: 5, merged: 1 });
    // Search index: the fragment carries the extracted text as its body.
    const fragments = fragmentsOf({
      entities: result.entities,
      sources: input.sources,
      keywordMentions: result.keywordMentions,
      recognised: result.recognised,
      documents: result.documents,
      config: input.config,
      fs: input.fs,
    });
    const text = (id: string): string | undefined =>
      fragments.find((fragment) => fragment.id === id)?.text;
    // The body of a merged entity: the plain text of its note, then the text of its documents.
    expect(text(REVIEW)).toBe(
      [
        "Notes of the workshop about the publication threshold.",
        "The build summary lists the workshop.",
        "The publication threshold on slide one",
        "Build summary of the workshop",
      ].join("\n"),
    );
    expect(text(VISION)).toBe(
      "The publication threshold is three occurrences in two files\nVision of the tool",
    );
    expect(text(TRANSCRIPT)).toBe(
      "The publication threshold stays at three occurrences.\nThe build summary will say so.",
    );
    expect(text(THRESHOLD)).toBe("Three occurrences in two files make a keyword page.");
    // Keyword discovery reads the pages too: "build summary" recurs in the note, the deck and the transcript.
    const summary = result.candidates.terms.find((term) => term.text === "build summary");
    expect(summary).toMatchObject({ occurrences: 3, documents: 3 });
    expect(summary?.contexts?.map((context) => [context.path, context.line])).toEqual([
      ["meetings/neighbourhood-cap.vtt", 2],
      ["meetings/threshold-review.md", 5],
      ["meetings/threshold-review.pptx", 2],
    ]);
  });

  it("keeps the position in the document, page, slide or timecode, so that the source can be cited", async () => {
    const { result } = await build();
    const cited = result.links
      .filter((link) => link.to === THRESHOLD)
      .flatMap((link) =>
        link.provenance
          .filter((provenance) => provenance.method === "glossary_occurrence")
          .map((provenance) => ({
            path: provenance.path,
            line: provenance.line,
            section: provenance.occurrences?.[0]?.section,
            context: provenance.occurrences?.[0]?.context,
          })),
      );
    expect(cited).toEqual([
      {
        path: "framing/vision.pdf",
        line: 1,
        section: "page 1",
        context: "The publication threshold is three occurrences in two files",
      },
      {
        path: "meetings/neighbourhood-cap.vtt",
        line: 1,
        section: "00:00:04",
        context: "The publication threshold stays at three occurrences.",
      },
      {
        path: "meetings/threshold-review.md",
        line: 3,
        section: undefined,
        context: "Notes of the workshop about the publication threshold.",
      },
      {
        path: "meetings/threshold-review.pptx",
        line: 1,
        section: "slide 1",
        context: "The publication threshold on slide one",
      },
    ]);
  });

  it("yields W-DOC-NOMD for a document without a markdown representation, usable as a work list", async () => {
    const { result } = await build();
    expect(
      result.findings
        .filter((finding) => finding.check === "W-DOC-NOMD")
        .map((finding) => [finding.entity, finding.path, finding.severity]),
    ).toEqual([
      [VISION, "framing/vision.pdf", "info"],
      [TRANSCRIPT, "meetings/neighbourhood-cap.vtt", "info"],
    ]);
    const vision = result.entities.find((entity) => entity.id === VISION);
    expect(vision).toMatchObject({
      type: "document",
      title: "vision",
      graph: "documents-only",
      attributes: { format: "pdf", pages: 2 },
    });
    const transcript = result.entities.find((entity) => entity.id === TRANSCRIPT);
    expect(transcript).toMatchObject({
      type: "meeting",
      attributes: { format: "vtt", duration: 75, speakers: ["Participant-1", "Participant-2"] },
    });
    expect(result.files).toBe(6);
    expect(result.unconverted).toBe(0);
  });

  it("keeps an unconverted document as a downloadable entity and counts it for the fail-on policy", async () => {
    const { result, input } = await build({ failing: true });
    expect(result.unconverted).toBe(1);
    expect(
      result.findings
        .filter((finding) => finding.check === "W-CONV-FAILED")
        .map((finding) => [finding.source, finding.path, finding.message]),
    ).toEqual([
      [
        "specs",
        "meetings/threshold-review.pptx",
        "conversion of meetings/threshold-review.pptx failed: soffice exited with code 1: cannot open",
      ],
    ]);
    // Without a PDF the deck has no text of its own, and still merges with its note by name and title.
    const review = result.entities.find((entity) => entity.id === REVIEW);
    expect(review?.representations?.map((representation) => representation.format)).toEqual([
      "markdown",
      "pptx",
    ]);
    const deck = result.documents.find((document) => document.format === "pptx");
    expect(deck?.pdf).toBeUndefined();
    expect(deck?.pages).toEqual([]);
    const fragment = fragmentsOf({
      entities: result.entities.filter((entity) => entity.id === REVIEW),
      sources: input.sources,
      keywordMentions: result.keywordMentions,
      recognised: result.recognised,
      documents: result.documents,
      config: input.config,
      fs: input.fs,
    })[0];
    expect(fragment?.documents).toEqual([
      {
        source: "specs",
        path: "meetings/threshold-review.pptx",
        format: "pptx",
        target: `${REVIEW}/meetings/threshold-review.pptx`,
        size: 12,
        pageCount: 2,
        unit: "slide",
        pages: [],
      },
    ]);
    expect(fragment?.text).toBe(
      "Notes of the workshop about the publication threshold.\nThe build summary lists the workshop.",
    );
  });

  it("scans the notes alone when no document was read", async () => {
    const { result, input } = await build();
    const dictionaries = buildDictionaries({
      entities: result.entities,
      config: input.config,
      stopwords: corpusStopwords({
        sources: input.sources,
        config: input.config,
        configDirectory: "/work",
        fs: input.fs,
      }),
    });
    const parsed = parseSources(input.sources, input.fs);
    const occurrences = scanNotes({
      documents: parsed.documents,
      sources: input.sources,
      dictionaries: dictionaries.byLocale,
      profile,
      config: input.config,
    });
    expect(new Set(occurrences.map((occurrence) => occurrence.path))).toEqual(
      new Set(["glossary/publication-threshold.md", "meetings/threshold-review.md"]),
    );
  });

  it("writes the documents of every entity into its fragment and copies the files and their previews under fragments/", async () => {
    const { result, input, fs } = await build();
    writeFragments(
      {
        entities: result.entities,
        sources: input.sources,
        keywordMentions: result.keywordMentions,
        recognised: result.recognised,
        documents: result.documents,
        config: input.config,
        fs,
      },
      "/work/dist",
    );
    const review = parseFragment(fs.readText(`/work/dist/fragments/${REVIEW}.json`), "review");
    expect(review.documents).toEqual([
      {
        source: "specs",
        path: "meetings/threshold-review.pptx",
        format: "pptx",
        target: `${REVIEW}/meetings/threshold-review.pptx`,
        preview: `${REVIEW}/meetings/threshold-review.pdf`,
        size: 12,
        pageCount: 2,
        unit: "slide",
        pages: [
          { number: 1, label: "slide 1", text: "The publication threshold on slide one" },
          { number: 2, label: "slide 2", text: "Build summary of the workshop" },
        ],
      },
    ]);
    expect(review.sections.length).toBeGreaterThan(0);
    expect(fs.readText(`/work/dist/fragments/${REVIEW}/meetings/threshold-review.pptx`)).toBe(
      "PK fake deck",
    );
    expect([
      ...fs.readBytes(`/work/dist/fragments/${REVIEW}/meetings/threshold-review.pdf`),
    ]).toEqual([...DECK_PDF]);
    const vision = parseFragment(fs.readText(`/work/dist/fragments/${VISION}.json`), "vision");
    expect(vision.sections).toEqual([]);
    expect(vision.documents?.[0]).toMatchObject({
      format: "pdf",
      target: `${VISION}/framing/vision.pdf`,
      preview: `${VISION}/framing/vision.pdf`,
      unit: "page",
    });
    expect(fs.exists(`/work/dist/fragments/${VISION}/framing/vision.pdf`)).toBe(true);
    const transcript = parseFragment(fs.readText(`/work/dist/fragments/${TRANSCRIPT}.json`), "vtt");
    expect(transcript.documents?.[0]).toMatchObject({
      format: "vtt",
      target: `${TRANSCRIPT}/meetings/neighbourhood-cap.vtt`,
      unit: "cue",
      pages: [
        {
          number: 1,
          label: "00:00:04",
          text: "The publication threshold stays at three occurrences.",
          speaker: "Participant-1",
        },
        {
          number: 2,
          label: "00:01:10",
          text: "The build summary will say so.",
          speaker: "Participant-2",
        },
      ],
    });
    expect(transcript.documents?.[0]).not.toHaveProperty("preview");
    expect(fs.readText(`/work/dist/fragments/${TRANSCRIPT}/meetings/neighbourhood-cap.vtt`)).toBe(
      vtt,
    );
    expect(
      fs.listFiles("/work/dist/fragments").filter((file) => file.endsWith("diagram.png")),
    ).toEqual([]);
  });

  it("cuts the extracted text at build.extracted_text_max_chars, in all, and leaves the previews out of a source that declines them", async () => {
    const { result, input } = await build();
    const config = parsedConfig(
      configText.replace("    path: ./specs\n", "    path: ./specs\n    previews: false\n") +
        "build: { extracted_text_max_chars: 45 }\n",
    );
    const fragments = fragmentsOf({
      entities: result.entities,
      sources: input.sources,
      keywordMentions: result.keywordMentions,
      recognised: result.recognised,
      documents: result.documents,
      config,
      fs: input.fs,
    });
    const review = fragments.find((fragment) => fragment.id === REVIEW);
    expect(review?.documents?.[0]?.pages).toEqual([
      { number: 1, label: "slide 1", text: "The publication threshold on slide one" },
      { number: 2, label: "slide 2", text: "Build s" },
    ]);
    expect(review?.text).toBe(
      [
        "Notes of the workshop about the publication threshold.",
        "The build summary lists the workshop.",
        "The publication threshold on slide one",
        "Build s",
      ].join("\n"),
    );
    expect(review?.documents?.[0]).not.toHaveProperty("preview");
    const vision = fragments.find((fragment) => fragment.id === VISION);
    expect(vision?.documents?.[0]).not.toHaveProperty("preview");
    expect(vision?.documents?.[0]?.pages.map((page) => page.text)).toEqual([
      "The publication threshold is three occurrence",
      "",
    ]);
  });

  it("converts the same document once across two builds: the cache is addressed by the fingerprint", async () => {
    const first = await build();
    const cached = first.fs.listFiles(cacheDirectory).filter((file) => file.startsWith("convert/"));
    expect(cached).toHaveLength(4);
    const again = await runPipeline(first.input);
    expect(again.documents).toEqual(first.result.documents);
    expect(
      first.fs.listFiles(cacheDirectory).filter((file) => file.startsWith("convert/")),
    ).toEqual(cached);
  });
});
