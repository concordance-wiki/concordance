import { memoryFileSystem, type ConverterInput } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import plugin, { createConverter, createPdfConverter, OFFICE_EXTENSIONS } from "../src/index.js";
import { fakeRunner, PDF_BYTES } from "./fake-runner.js";

const encoder = new TextEncoder();

function input(overrides: Partial<ConverterInput["payload"]> = {}): ConverterInput {
  return {
    path: "/repo/decks/kickoff.pptx",
    payload: {
      bytes: encoder.encode("hello"),
      sha256: "abc123",
      cacheDirectory: "/pipeline/.concordance-cache",
      options: { timeoutMs: 120_000, maxSizeBytes: 50 * 1024 * 1024 },
      ...overrides,
    },
  };
}

describe("@concordance-wiki/plugin-convert-libreoffice", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "OFFICE_EXTENSIONS",
      "PDF_EXTENSION",
      "SOFFICE",
      "SUSPECT_SOURCE_BYTES",
      "convertMany",
      "convertToPdf",
      "createConverter",
      "createPdfConverter",
      "default",
      "extractPdfPages",
      "extractPdfText",
      "extractedTextPath",
      "nodeCommandRunner",
      "sha256Of",
    ]);
  });

  it("declares LibreOffice as the system dependency detected through soffice, so that the registry disables the plugin with a finding when it is missing", () => {
    expect(plugin.name).toBe("@concordance-wiki/plugin-convert-libreoffice");
    expect(plugin.apiVersion).toBe("1");
    expect(plugin.systemDependencies).toEqual([{ name: "LibreOffice", check: "soffice" }]);
  });

  it("contributes a converter for docx, pptx and xlsx and one for pdf, both producing pdf and text", () => {
    expect(OFFICE_EXTENSIONS).toEqual([".docx", ".pptx", ".xlsx"]);
    expect(plugin.contributes.converters?.map((c) => [c.extensions, c.produces])).toEqual([
      [
        [".docx", ".pptx", ".xlsx"],
        ["pdf", "text"],
      ],
      [[".pdf"], ["pdf", "text"]],
    ]);
  });

  it("reads a PDF source through the PDF converter without LibreOffice: the text comes from the same extraction", async () => {
    const fs = memoryFileSystem();
    const runner = fakeRunner(fs);
    const converter = createPdfConverter({
      runner,
      fs,
      extractPages: () => Promise.resolve(["Vision", "Non-goals"]),
    });
    const output = await converter.convert({
      ...input(),
      path: "/repo/framing/vision.pdf",
    });
    expect(runner.calls).toEqual([]);
    expect(output.representations).toEqual({
      pdf: { path: "/pipeline/.concordance-cache/convert/abc123.pdf" },
      text: { path: "/pipeline/.concordance-cache/convert/abc123.text.json" },
    });
    expect(
      JSON.parse(fs.readText("/pipeline/.concordance-cache/convert/abc123.text.json")),
    ).toEqual({ pages: ["Vision", "Non-goals"] });
    const refused = await converter.convert(input());
    expect(refused.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/decks/kickoff.pptx failed: extension .pptx is not converted by this plugin",
    ]);
  });

  it("hands the payload of a converter input to the conversion over the injected effects", async () => {
    const fs = memoryFileSystem();
    const runner = fakeRunner(fs);
    const extracted: Uint8Array[] = [];
    const converter = createConverter({
      runner,
      fs,
      extractPages: (pdf) => {
        extracted.push(pdf);
        return Promise.resolve([]);
      },
    });
    const large = input({ bytes: new Uint8Array(200 * 1024), sha256: "large" });
    const output = await converter.convert(large);
    expect(runner.calls.map((call) => call.options)).toEqual([
      { cwd: "/pipeline/.concordance-cache/convert/work/large", timeoutMs: 120_000 },
    ]);
    expect(output.representations).toEqual({
      pdf: { path: "/pipeline/.concordance-cache/convert/large.pdf" },
      text: { path: "/pipeline/.concordance-cache/convert/large.text.json" },
    });
    expect(extracted.map((pdf) => [...pdf])).toEqual([[...PDF_BYTES]]);
    expect(output.findings.map((finding) => finding.check)).toEqual(["W-CONV-SUSPECT"]);
  });

  it("applies the limits carried by the payload with the Node effects by default", async () => {
    const converter = plugin.contributes.converters?.[0];
    const output = await converter?.convert(
      input({ options: { timeoutMs: 120_000, maxSizeBytes: 4 } }),
    );
    expect(output?.representations).toEqual({});
    expect(output?.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/decks/kickoff.pptx failed: the document weighs 0.0 MB, above the maximum of 0.0 MB",
    ]);
  });
});
