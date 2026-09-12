import { memoryFileSystem, type ConverterInput } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import plugin, { createConverter, OFFICE_EXTENSIONS } from "../src/index.js";
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
      "SOFFICE",
      "SUSPECT_SOURCE_BYTES",
      "convertMany",
      "convertToPdf",
      "createConverter",
      "default",
      "extractPdfText",
      "nodeCommandRunner",
      "sha256Of",
    ]);
  });

  it("declares LibreOffice as the system dependency detected through soffice, so that the registry disables the plugin with a finding when it is missing", () => {
    expect(plugin.name).toBe("@concordance-wiki/plugin-convert-libreoffice");
    expect(plugin.apiVersion).toBe("1");
    expect(plugin.systemDependencies).toEqual([{ name: "LibreOffice", check: "soffice" }]);
  });

  it("contributes one converter for docx, pptx and xlsx that produces pdf", () => {
    expect(OFFICE_EXTENSIONS).toEqual([".docx", ".pptx", ".xlsx"]);
    expect(plugin.contributes.converters?.map((c) => [c.extensions, c.produces])).toEqual([
      [[".docx", ".pptx", ".xlsx"], ["pdf"]],
    ]);
  });

  it("hands the payload of a converter input to the conversion over the injected effects", async () => {
    const fs = memoryFileSystem();
    const runner = fakeRunner(fs);
    const extracted: Uint8Array[] = [];
    const converter = createConverter({
      runner,
      fs,
      extractText: (pdf) => {
        extracted.push(pdf);
        return Promise.resolve("");
      },
    });
    const large = input({ bytes: new Uint8Array(200 * 1024), sha256: "large" });
    const output = await converter.convert(large);
    expect(runner.calls.map((call) => call.options)).toEqual([
      { cwd: "/pipeline/.concordance-cache/convert/work/large", timeoutMs: 120_000 },
    ]);
    expect(output.representations).toEqual({
      pdf: { path: "/pipeline/.concordance-cache/convert/large.pdf" },
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
