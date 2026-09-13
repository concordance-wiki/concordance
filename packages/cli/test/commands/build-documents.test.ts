import { createHash } from "node:crypto";

import { definePlugin, parseModel, type Converter, type Reader } from "@concordance-wiki/core";
import { parseFragment } from "@concordance-wiki/site";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { recordedIo, tinyPdf, validConfig, type RecordedIo } from "../helpers.js";

const encoder = new TextEncoder();

/** A reader for decks and a converter that keeps a fake PDF and its text, or fails on demand. */
function documentPlugin(failing: string[] = []) {
  const seen: number[] = [];
  const reader: Reader = {
    extensions: [".pptx"],
    read: () => ({ metadata: { title: "Keyword page threshold review" }, text: "" }),
  };
  const converter: Converter = {
    extensions: [".pptx"],
    produces: ["pdf", "text"],
    convert: ({ path, payload }) => {
      seen.push(payload.options.timeoutMs);
      if (failing.includes(path)) {
        return Promise.resolve({
          representations: {},
          findings: [
            {
              check: "W-CONV-FAILED",
              severity: "warning",
              message: `conversion of ${path} failed: soffice exited with code 1`,
              remediation: "check that the document opens in LibreOffice",
              path,
            },
          ],
        });
      }
      const pdf = `${payload.cacheDirectory}/convert/${payload.sha256}.pdf`;
      const text = `${payload.cacheDirectory}/convert/${payload.sha256}.text.json`;
      return Promise.resolve({
        representations: { pdf: { path: pdf }, text: { path: text } },
        findings: [],
      });
    },
  };
  const manifest = definePlugin({
    name: "example-documents",
    version: "1.0.0",
    apiVersion: "1",
    contributes: { readers: [reader], converters: [converter] },
  });
  return {
    seen,
    deps: {
      load: () => Promise.resolve(manifest),
      commandAvailable: () => Promise.resolve(true),
      parallelism: 3,
    },
  };
}

function corpus(extra = ""): RecordedIo {
  const io = recordedIo({
    "/work/concordance.yaml": `${validConfig}plugins: [example-documents]\n${extra}`,
    "/work/notes/threshold.md": "# Threshold\n\nThree occurrences in two files.\n",
    "/work/notes/decks/threshold-review.pptx": "PK deck",
    "/work/notes/decks/roadmap.pptx": "PK roadmap",
  });
  // The converter of the test writes nothing: the cache is seeded with the PDF and its text.
  const cache = "/work/.concordance-cache/convert";
  for (const bytes of ["PK deck", "PK roadmap"]) {
    const sha = shaOf(bytes);
    io.fs.writeBytes(`${cache}/${sha}.pdf`, tinyPdf(["Threshold on the slide"]));
    io.fs.writeText(`${cache}/${sha}.text.json`, '{"pages":["Threshold on the slide"]}');
  }
  return io;
}

function shaOf(text: string): string {
  return createHash("sha256").update(encoder.encode(text)).digest("hex");
}

describe("concordance build with documents", () => {
  it("copies the original file and its PDF preview next to the page and lists the document on the to-do page", async () => {
    const io = corpus();
    const plugin = documentPlugin();
    expect(await buildCommand([], io, plugin.deps)).toBe(0);
    expect(plugin.seen).toEqual([120_000, 120_000]);
    const model = parseModel(io.fs.readText("/work/dist/model.json"), "model.json");
    expect(model.entities.map((entity) => `${entity.id}:${entity.type}`)).toEqual([
      "notes/decks/roadmap.pptx:document",
      "notes/decks/threshold-review.pptx:document",
      "notes/threshold:document",
    ]);
    const deck = "notes/decks/threshold-review.pptx";
    expect(io.fs.readText(`/work/dist/${deck}/decks/threshold-review.pptx`)).toBe("PK deck");
    expect(io.fs.exists(`/work/dist/${deck}/decks/threshold-review.pdf`)).toBe(true);
    const fragment = parseFragment(io.fs.readText(`/work/dist/fragments/${deck}.json`), "f");
    expect(fragment.documents?.[0]).toMatchObject({
      target: `${deck}/decks/threshold-review.pptx`,
      preview: `${deck}/decks/threshold-review.pdf`,
      pages: [{ number: 1, label: "slide 1", text: "Threshold on the slide" }],
    });
    expect(fragment.text).toBe("Threshold on the slide");
    // The extracted text feeds the search index: "slide" is said in the deck and nowhere else.
    expect(io.fs.readText("/work/dist/search/sl.js")).toContain('"slide"');
    expect(io.fs.readText("/work/dist/search/meta.js")).toContain(deck);
    expect(model.findings.filter((finding) => finding.check === "W-DOC-NOMD")).toHaveLength(2);
    expect(io.fs.readText("/work/dist/todo/index.html")).toContain("Keyword page threshold review");
    // The deck cites the note's term from its slide, and the note's page says so.
    expect(io.fs.readText("/work/dist/notes/threshold/index.html")).toContain("slide 1");
  });

  it("fails the build beyond build.fail_on.unconverted_max unconverted documents, the site written all the same", async () => {
    const io = corpus("build: { fail_on: { unconverted_max: 0 } }\n");
    const plugin = documentPlugin(["decks/roadmap.pptx"]);
    expect(await buildCommand([], io, plugin.deps)).toBe(1);
    expect(io.stderr.at(-1)).toBe("build failed: 1 unconverted document(s), more than 0");
    expect(io.fs.exists("/work/dist/notes/decks/roadmap.pptx/index.html")).toBe(true);
    expect(io.fs.readText("/work/dist/notes/decks/roadmap.pptx/decks/roadmap.pptx")).toBe(
      "PK roadmap",
    );
    expect(io.fs.exists("/work/dist/notes/decks/roadmap.pptx/decks/roadmap.pdf")).toBe(false);
  });

  it("converts with the parallelism of the configuration, else the cores the command was given, else one", async () => {
    const io = corpus("conversion: { parallelism: 1 }\n");
    const plugin = documentPlugin();
    expect(await buildCommand([], io, plugin.deps)).toBe(0);
    const again = corpus();
    const { parallelism, ...withoutCores } = plugin.deps;
    expect(parallelism).toBe(3);
    expect(await buildCommand([], again, withoutCores)).toBe(0);
    expect(again.stderr.filter((line) => line.includes("W-CONV"))).toEqual([]);
  });
});
