import {
  memoryFileSystem,
  parseConfig,
  type Config,
  type Converter,
  type Entity,
  type Reader,
} from "@concordance-wiki/core";
import type { IngestedSource } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import {
  conversionEnabled,
  conversionLimits,
  documentsWithoutMarkdown,
  hasMarkdown,
  inParallel,
  pageParagraphs,
  readDocuments,
  resourcesOf,
  type ReadDocument,
} from "../src/pipeline/documents.js";

const encoder = new TextEncoder();

function config(text: string): Config {
  const parsed = parseConfig(text);
  if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.message).join("; "));
  return parsed.config;
}

const baseConfig = config(
  [
    "version: 1",
    "project: { name: Concordance wiki }",
    "sources:",
    "  - { name: specs, path: ./specs }",
    "  - { name: archive, path: ./archive, convert: false }",
    "",
  ].join("\n"),
);

function source(name: string, paths: string[]): IngestedSource {
  return {
    name,
    locale: "en",
    root: `/work/${name}`,
    files: paths.map((path) => ({
      path,
      absolutePath: `/work/${name}/${path}`,
      modifiedAt: "2026-03-12T10:00:00.000Z",
    })),
  };
}

/** A reader that reports the file name as the title and, for transcripts, two cues. */
const reader: Reader = {
  extensions: [".pptx", ".VTT", ".pdf"],
  read: ({ path, payload }) => {
    if (path.endsWith(".vtt")) {
      return {
        metadata: { format: "vtt" },
        text: "Threshold review starts.\nThree occurrences in two files.",
        units: [
          { label: "00:00:04", text: "Threshold review starts.", anchor: "t-4000" },
          { label: "00:01:10", text: "Three occurrences in two files." },
        ],
      };
    }
    return {
      metadata: { title: path.slice(path.lastIndexOf("/") + 1), bytes: payload.bytes.byteLength },
      text: "reader text that must never be read",
    };
  },
};

/** A converter that writes a PDF and a text representation into the cache, or fails on demand. */
function converter(fs: ReturnType<typeof memoryFileSystem>, failing: string[] = []): Converter {
  const calls: string[] = [];
  return {
    extensions: [".pptx", ".docx", ".pdf"],
    produces: ["pdf", "text"],
    convert: ({ path, payload }) => {
      calls.push(`${path} ${payload.sha256.slice(0, 8)} ${String(payload.options.timeoutMs)}`);
      if (failing.includes(path)) {
        return Promise.resolve({
          representations: {},
          findings: [
            {
              check: "W-CONV-FAILED",
              severity: "warning",
              message: `conversion of ${path} failed: timed out`,
              remediation: "reduce the document",
              path,
            },
          ],
        });
      }
      const pdf = `${payload.cacheDirectory}/convert/${payload.sha256}.pdf`;
      const text = `${payload.cacheDirectory}/convert/${payload.sha256}.text.json`;
      fs.writeBytes(pdf, encoder.encode("%PDF"));
      fs.writeText(
        text,
        JSON.stringify({ pages: ["Keyword page threshold", "", "Build summary"] }),
      );
      return Promise.resolve({
        representations: { pdf: { path: pdf }, text: { path: text } },
        findings: [],
      });
    },
  };
}

describe("readDocuments", () => {
  it("reads every file a reader or a converter accepts, whatever the case of the extension, and skips the rest", async () => {
    const fs = memoryFileSystem({
      "/work/specs/decks/threshold.pptx": "deck",
      "/work/specs/meetings/review.vtt": "WEBVTT",
      "/work/specs/diagram.png": "png",
      "/work/specs/notes.md": "# Notes",
      "/work/specs/report.DOCX": "doc",
    });
    const output = await readDocuments({
      sources: [
        source("specs", [
          "decks/threshold.pptx",
          "diagram.png",
          "meetings/review.vtt",
          "notes.md",
          "report.DOCX",
        ]),
      ],
      readers: [reader],
      converters: [converter(fs)],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 2,
      fs,
    });
    expect(output.findings).toEqual([]);
    expect(output.unconverted).toBe(0);
    expect(
      output.documents.map((document) => [document.path, document.format, document.unit]),
    ).toEqual([
      ["decks/threshold.pptx", "pptx", "slide"],
      ["meetings/review.vtt", "vtt", "cue"],
      ["report.DOCX", "docx", "page"],
    ]);
  });

  it("takes the text of an office document from the PDF the converter produced, never from its reader", async () => {
    const fs = memoryFileSystem({ "/work/specs/decks/threshold.pptx": "deck" });
    const output = await readDocuments({
      sources: [source("specs", ["decks/threshold.pptx"])],
      readers: [reader],
      converters: [converter(fs)],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    const [deck] = output.documents;
    expect(deck?.metadata).toEqual({ title: "threshold.pptx", bytes: 4 });
    expect(deck?.pdf).toMatch(/^\/work\/\.concordance-cache\/convert\/[0-9a-f]{64}\.pdf$/);
    expect(deck?.pages).toEqual([
      { number: 1, label: "slide 1", text: "Keyword page threshold" },
      { number: 2, label: "slide 2", text: "" },
      { number: 3, label: "slide 3", text: "Build summary" },
    ]);
    expect(JSON.stringify(deck)).not.toContain("reader text");
  });

  it("keeps the cues of a transcript as its positions, labelled by their timecodes", async () => {
    const fs = memoryFileSystem({ "/work/specs/meetings/review.vtt": "WEBVTT" });
    const output = await readDocuments({
      sources: [source("specs", ["meetings/review.vtt"])],
      readers: [reader],
      converters: [],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(output.documents[0]?.pages).toEqual([
      { number: 1, label: "00:00:04", text: "Threshold review starts.", anchor: "t-4000" },
      { number: 2, label: "00:01:10", text: "Three occurrences in two files." },
    ]);
    expect(output.documents[0]?.pdf).toBeUndefined();
  });

  it("gives a reader's text without positions a single page, and no page to an empty text", async () => {
    const fs = memoryFileSystem({ "/work/specs/a.txt": "a", "/work/specs/b.txt": "b" });
    const plain: Reader = {
      extensions: [".txt"],
      read: ({ path }) => ({ metadata: {}, text: path.endsWith("a.txt") ? "Plain words" : " " }),
    };
    const output = await readDocuments({
      sources: [source("specs", ["a.txt", "b.txt"])],
      readers: [plain],
      converters: [],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(output.documents.map((document) => document.pages)).toEqual([
      [{ number: 1, label: "page 1", text: "Plain words" }],
      [],
    ]);
  });

  it("counts a failed conversion as unconverted, keeps the finding with its source, and still lists the document", async () => {
    const fs = memoryFileSystem({
      "/work/specs/decks/a.pptx": "a",
      "/work/specs/decks/b.pptx": "b",
    });
    const output = await readDocuments({
      sources: [source("specs", ["decks/a.pptx", "decks/b.pptx"])],
      readers: [reader],
      converters: [converter(fs, ["decks/b.pptx"])],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 4,
      fs,
    });
    expect(output.unconverted).toBe(1);
    expect(output.findings).toEqual([
      {
        check: "W-CONV-FAILED",
        severity: "warning",
        source: "specs",
        path: "decks/b.pptx",
        message: "conversion of decks/b.pptx failed: timed out",
        remediation: "reduce the document",
      },
    ]);
    expect(output.documents.map((document) => [document.path, document.pdf === undefined])).toEqual(
      [
        ["decks/a.pptx", false],
        ["decks/b.pptx", true],
      ],
    );
    // Without a PDF an office document has no text: its reader's never counts.
    expect(output.documents[1]?.pages).toEqual([]);
  });

  it("does not convert the documents of a source declaring convert: false, and reads them all the same", async () => {
    const fs = memoryFileSystem({ "/work/archive/old.pptx": "old" });
    const output = await readDocuments({
      sources: [source("archive", ["old.pptx"])],
      readers: [reader],
      converters: [converter(fs)],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(output.unconverted).toBe(0);
    expect(output.documents[0]?.pdf).toBeUndefined();
    expect(output.documents[0]?.pages).toEqual([]);
    expect(output.documents[0]?.metadata).toEqual({ title: "old.pptx", bytes: 3 });
    expect(fs.listFiles("/work/.concordance-cache")).toEqual([]);
  });

  it("reports a reader that throws as W-CONV-FAILED and keeps the document without metadata", async () => {
    const fs = memoryFileSystem({ "/work/specs/broken.pptx": "x" });
    const throwing: Reader = {
      extensions: [".pptx"],
      read: ({ path }) => {
        throw new Error(`${path}: not a zip archive`);
      },
    };
    const output = await readDocuments({
      sources: [source("specs", ["broken.pptx"])],
      readers: [throwing],
      converters: [converter(fs)],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(output.findings).toEqual([
      {
        check: "W-CONV-FAILED",
        severity: "warning",
        source: "specs",
        path: "broken.pptx",
        message: "reading of broken.pptx failed: broken.pptx: not a zip archive",
        remediation: "check that the file opens in the application that produced it",
      },
    ]);
    expect(output.unconverted).toBe(0);
    expect(output.documents[0]?.metadata).toEqual({});
    expect(output.documents[0]?.pages.map((page) => page.text)).toEqual([
      "Keyword page threshold",
      "",
      "Build summary",
    ]);
    const plain: Reader = {
      extensions: [".pptx"],
      read: () => {
        // A reader may throw anything; the message names it.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "corrupt";
      },
    };
    const again = await readDocuments({
      sources: [source("specs", ["broken.pptx"])],
      readers: [plain],
      converters: [],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(again.findings.map((finding) => finding.message)).toEqual([
      "reading of broken.pptx failed: corrupt",
    ]);
  });

  it("ignores a text representation that does not hold a list of pages", async () => {
    const fs = memoryFileSystem({ "/work/specs/a.pdf": "%PDF" });
    const odd: Converter = {
      extensions: [".pdf"],
      produces: ["pdf", "text"],
      convert: ({ payload }) => {
        fs.writeText(`${payload.cacheDirectory}/odd.json`, '{"pages": [1, "two"]}');
        fs.writeText(`${payload.cacheDirectory}/none.json`, '"text"');
        return Promise.resolve({
          representations: {
            pdf: { path: "/pdf" },
            text: {
              path: `${payload.cacheDirectory}/${payload.bytes.byteLength === 4 ? "odd" : "none"}.json`,
            },
          },
          findings: [],
        });
      },
    };
    const output = await readDocuments({
      sources: [source("specs", ["a.pdf"])],
      readers: [],
      converters: [odd],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(output.documents[0]?.pages).toEqual([
      { number: 1, label: "page 1", text: "" },
      { number: 2, label: "page 2", text: "two" },
    ]);
    fs.writeText("/work/specs/a.pdf", "%PDF-");
    const none = await readDocuments({
      sources: [source("specs", ["a.pdf"])],
      readers: [],
      converters: [odd],
      config: baseConfig,
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(none.documents[0]?.pages).toEqual([]);
  });

  it("orders the documents by source then path whatever the order the conversions finish in", async () => {
    const fs = memoryFileSystem({
      "/work/specs/z.pptx": "z",
      "/work/specs/a.pptx": "a",
      "/work/archive/m.pptx": "m",
    });
    const slow: Converter = {
      extensions: [".pptx"],
      produces: ["pdf"],
      convert: ({ path }) =>
        new Promise((resolve) => {
          setTimeout(
            () => {
              resolve({ representations: { pdf: { path: `/cache/${path}.pdf` } }, findings: [] });
            },
            path.startsWith("a") ? 20 : 1,
          );
        }),
    };
    const output = await readDocuments({
      sources: [source("specs", ["z.pptx", "a.pptx"]), source("archive", ["m.pptx"])],
      readers: [],
      converters: [slow],
      config: config(
        [
          "version: 1",
          "project: { name: Concordance wiki }",
          "sources: [{ name: specs, path: ./specs }, { name: archive, path: ./archive }]",
          "",
        ].join("\n"),
      ),
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 3,
      fs,
    });
    expect(output.documents.map((document) => `${document.source}/${document.path}`)).toEqual([
      "archive/m.pptx",
      "specs/a.pptx",
      "specs/z.pptx",
    ]);
    expect(output.documents.map((document) => document.pdf)).toEqual([
      "/cache/m.pptx.pdf",
      "/cache/a.pptx.pdf",
      "/cache/z.pptx.pdf",
    ]);
  });

  it("hands the converter the limits of the configuration and the fingerprint of the bytes", async () => {
    const fs = memoryFileSystem({ "/work/specs/a.pptx": "hello" });
    const seen: unknown[] = [];
    const spy: Converter = {
      extensions: [".pptx"],
      produces: ["pdf"],
      convert: ({ payload }) => {
        seen.push({ ...payload, bytes: [...payload.bytes] });
        return Promise.resolve({ representations: {}, findings: [] });
      },
    };
    await readDocuments({
      sources: [source("specs", ["a.pptx"])],
      readers: [],
      converters: [spy],
      config: config(
        [
          "version: 1",
          "project: { name: Concordance wiki }",
          "sources: [{ name: specs, path: ./specs }]",
          "conversion: { timeout_s: 30, max_size_mb: 2 }",
          "",
        ].join("\n"),
      ),
      cacheDirectory: "/work/.concordance-cache",
      parallelism: 1,
      fs,
    });
    expect(seen).toEqual([
      {
        bytes: [...encoder.encode("hello")],
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        cacheDirectory: "/work/.concordance-cache",
        options: { timeoutMs: 30_000, maxSizeBytes: 2 * 1024 * 1024 },
      },
    ]);
  });
});

describe("conversion settings", () => {
  it("defaults to 120 s and 50 MB", () => {
    expect(conversionLimits(baseConfig)).toEqual({
      timeoutMs: 120_000,
      maxSizeBytes: 50 * 1024 * 1024,
    });
  });

  it("converts unless the source says convert: false, an unknown source included", () => {
    expect(conversionEnabled(baseConfig, "specs")).toBe(true);
    expect(conversionEnabled(baseConfig, "archive")).toBe(false);
    expect(conversionEnabled(baseConfig, "elsewhere")).toBe(true);
  });
});

describe("inParallel", () => {
  it("runs at most the given number of jobs at a time and keeps the input order", async () => {
    let running = 0;
    let peak = 0;
    const results = await inParallel([30, 5, 10, 1], 2, (delay) => {
      running += 1;
      peak = Math.max(peak, running);
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          running -= 1;
          resolve(delay * 2);
        }, delay);
      });
    });
    expect(results).toEqual([60, 10, 20, 2]);
    expect(peak).toBe(2);
  });

  it("runs one at a time for a parallelism under one, and does nothing for no input", async () => {
    let peak = 0;
    let running = 0;
    await inParallel([1, 2, 3], 0.5, (delay) => {
      running += 1;
      peak = Math.max(peak, running);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          running -= 1;
          resolve();
        }, delay);
      });
    });
    expect(peak).toBe(1);
    expect(await inParallel([], 4, () => Promise.resolve(1))).toEqual([]);
  });
});

const deck: ReadDocument = {
  source: "specs",
  path: "decks/threshold.pptx",
  absolutePath: "/work/specs/decks/threshold.pptx",
  format: "pptx",
  metadata: { title: "Threshold" },
  unit: "slide",
  pages: [
    { number: 1, label: "slide 1", text: "Keyword page threshold" },
    { number: 2, label: "slide 2", text: "  " },
    { number: 3, label: "slide 3", text: "Build summary" },
  ],
  pdf: "/cache/x.pdf",
};

describe("resourcesOf and pageParagraphs", () => {
  it("keys the documents for the typing step with their format and metadata", () => {
    expect(resourcesOf([deck])).toEqual(
      new Map([
        ["specs/decks/threshold.pptx", { format: "pptx", metadata: { title: "Threshold" } }],
      ]),
    );
  });

  it("reads a document as one paragraph per position with text, the number as the line and the label as the section", () => {
    expect(pageParagraphs(deck)).toEqual([
      { line: 1, text: "Keyword page threshold", section: "slide 1" },
      { line: 3, text: "Build summary", section: "slide 3" },
    ]);
  });
});

function entity(id: string, path: string, overrides: Partial<Entity> = {}): Entity {
  return {
    id,
    type: "document",
    title: id,
    aliases: [],
    locale: "en",
    status: "valid",
    type_origin: "source",
    graph: "documents-only",
    attributes: {},
    source: { name: "specs", path, line: 1 },
    ...overrides,
  };
}

describe("documentsWithoutMarkdown", () => {
  it("reports W-DOC-NOMD for every document that stands alone or merged with other documents only, sorted", () => {
    const transcript = { ...deck, path: "meetings/review.vtt", format: "vtt" };
    const findings = documentsWithoutMarkdown(
      [
        entity("specs/decks/threshold.pptx", "decks/threshold.pptx"),
        entity("specs/meetings/review", "meetings/review.md", {
          representations: [
            { path: "meetings/review.md", format: "markdown" },
            { path: "meetings/review.vtt", format: "vtt" },
          ],
        }),
        entity("specs/other", "other.md"),
        entity("keywords/build-summary", "decks/threshold.pptx", { keyword: true }),
        entity("specs/api/model-query/list-entities", "contracts/model-query.openapi.json"),
      ],
      [deck, transcript],
    );
    expect(findings).toEqual([
      {
        check: "W-DOC-NOMD",
        severity: "info",
        source: "specs",
        path: "decks/threshold.pptx",
        entity: "specs/decks/threshold.pptx",
        message: "decks/threshold.pptx has no markdown representation",
        remediation:
          "Write a markdown note next to the document, with the same base name or a frontmatter source pointing at it.",
      },
    ]);
    const grouped = documentsWithoutMarkdown(
      [
        entity("specs/decks/threshold.pptx", "decks/threshold.pptx", {
          representations: [
            { path: "decks/threshold.pptx", format: "pptx" },
            { path: "meetings/review.vtt", format: "vtt" },
          ],
        }),
        entity("specs/meetings/review.vtt", "meetings/review.vtt"),
      ],
      [deck, transcript],
    );
    expect(grouped.map((finding) => finding.entity)).toEqual([
      "specs/decks/threshold.pptx",
      "specs/meetings/review.vtt",
    ]);
  });

  it("knows a markdown representation when it sees one", () => {
    expect(hasMarkdown(entity("a/b", "b.pptx"))).toBe(false);
    expect(
      hasMarkdown(
        entity("a/b", "b.pptx", { representations: [{ path: "b.md", format: "markdown" }] }),
      ),
    ).toBe(true);
  });
});
