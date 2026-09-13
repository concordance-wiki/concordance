import { createHash } from "node:crypto";

import { memoryFileSystem, type MemoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  convertToPdf,
  extractedTextPath,
  sha256Of,
  SUSPECT_SOURCE_BYTES,
  type ConvertOptions,
} from "../src/convert.js";
import { fakeRunner, PDF_BYTES, type Behaviour } from "./fake-runner.js";

const encoder = new TextEncoder();
const options: ConvertOptions = {
  extensions: [".docx", ".pptx", ".xlsx"],
  timeoutMs: 120_000,
  maxSizeBytes: 50 * 1024 * 1024,
};
const cacheDirectory = "/pipeline/.concordance-cache";
const hello = encoder.encode("hello");
const helloSha = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function harness(behaviour?: Behaviour, pages: string[] = ["some text"]) {
  const fs: MemoryFileSystem = memoryFileSystem();
  const runner = fakeRunner(fs, behaviour);
  const extracted: Uint8Array[] = [];
  const deps = {
    runner,
    fs,
    cacheDirectory,
    extractPages: (pdf: Uint8Array) => {
      extracted.push(pdf);
      return Promise.resolve(pages);
    },
  };
  return { fs, runner, deps, extracted };
}

const textOf = (sha: string): string => extractedTextPath(cacheDirectory, sha);

describe("convertToPdf", () => {
  it.each([".docx", ".pptx", ".xlsx"])(
    "converts %s files to PDF through headless LibreOffice",
    async (extension) => {
      const { fs, runner, deps } = harness();
      const path = `/repo/decks/kickoff${extension}`;
      const output = await convertToPdf({ path, bytes: hello }, options, deps);
      const work = `${cacheDirectory}/convert/work/${helloSha}`;
      expect(runner.calls).toEqual([
        {
          command: "soffice",
          args: [
            "--headless",
            "--norestore",
            `-env:UserInstallation=file://${work}/profile`,
            "--convert-to",
            "pdf",
            "--outdir",
            work,
            `${work}/kickoff${extension}`,
          ],
          options: { cwd: work, timeoutMs: 120_000 },
        },
      ]);
      expect(output).toEqual({
        representations: {
          pdf: { path: `${cacheDirectory}/convert/${helloSha}.pdf` },
          text: { path: textOf(helloSha) },
        },
        findings: [],
      });
      expect([...fs.readBytes(`${cacheDirectory}/convert/${helloSha}.pdf`)]).toEqual([
        ...PDF_BYTES,
      ]);
      expect(JSON.parse(fs.readText(textOf(helloSha)))).toEqual({ pages: ["some text"] });
      expect(fs.exists(work)).toBe(false);
    },
  );

  it("addresses the cache by the SHA-256 fingerprint of the source file: no unchanged file is reconverted nor re-read", async () => {
    const { runner, deps, extracted } = harness();
    const first = await convertToPdf({ path: "/repo/a.docx", bytes: hello }, options, deps);
    expect(runner.calls).toHaveLength(1);
    expect(extracted).toHaveLength(1);
    const again = await convertToPdf({ path: "/repo/moved/a.docx", bytes: hello }, options, deps);
    expect(runner.calls).toHaveLength(1);
    expect(extracted).toHaveLength(1);
    expect(again).toEqual(first);
    const changed = await convertToPdf(
      { path: "/repo/a.docx", bytes: encoder.encode("hello!") },
      options,
      deps,
    );
    expect(runner.calls).toHaveLength(2);
    expect(changed.representations.pdf?.path).not.toBe(first.representations.pdf?.path);
  });

  it("trusts the fingerprint given by the caller instead of hashing the bytes again", async () => {
    const { fs, deps } = harness();
    const output = await convertToPdf(
      { path: "/repo/a.docx", bytes: hello, sha256: "given" },
      options,
      deps,
    );
    expect(output.representations.pdf?.path).toBe(`${cacheDirectory}/convert/given.pdf`);
    expect(fs.exists(`${cacheDirectory}/convert/given.pdf`)).toBe(true);
    expect(output.representations.text?.path).toBe(textOf("given"));
  });

  it("extracts the text again when the cache holds the PDF but not its text, as a cache of the previous version does", async () => {
    const { fs, runner, deps, extracted } = harness(undefined, ["page one", "page two"]);
    fs.writeBytes(`${cacheDirectory}/convert/${helloSha}.pdf`, PDF_BYTES);
    const output = await convertToPdf({ path: "/repo/a.docx", bytes: hello }, options, deps);
    expect(runner.calls).toEqual([]);
    expect(extracted.map((pdf) => [...pdf])).toEqual([[...PDF_BYTES]]);
    expect(output.representations.text?.path).toBe(textOf(helloSha));
    expect(JSON.parse(fs.readText(textOf(helloSha)))).toEqual({ pages: ["page one", "page two"] });
  });

  it("keeps a PDF source as its own representation and extracts its text without running LibreOffice, so that every text comes from one path", async () => {
    const { fs, runner, deps, extracted } = harness(undefined, ["Build summary"]);
    const pdf = encoder.encode("%PDF-1.4 source");
    const sha = sha256Of(pdf);
    const output = await convertToPdf(
      { path: "/repo/framing/vision.pdf", bytes: pdf },
      { ...options, extensions: [".pdf"] },
      deps,
    );
    expect(runner.calls).toEqual([]);
    expect(extracted.map((bytes) => [...bytes])).toEqual([[...pdf]]);
    expect(output).toEqual({
      representations: {
        pdf: { path: `${cacheDirectory}/convert/${sha}.pdf` },
        text: { path: textOf(sha) },
      },
      findings: [],
    });
    expect([...fs.readBytes(`${cacheDirectory}/convert/${sha}.pdf`)]).toEqual([...pdf]);
    const again = await convertToPdf(
      { path: "/repo/framing/vision.pdf", bytes: pdf },
      { ...options, extensions: [".pdf"] },
      deps,
    );
    expect(extracted).toHaveLength(1);
    expect(again).toEqual(output);
  });

  it("reports W-CONV-SUSPECT on a large PDF source without extractable text, naming the PDF itself", async () => {
    const { deps } = harness(undefined, [""]);
    const bytes = new Uint8Array(SUSPECT_SOURCE_BYTES + 1);
    const output = await convertToPdf(
      { path: "/repo/scan.pdf", bytes },
      { ...options, extensions: [".pdf"] },
      deps,
    );
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "the PDF /repo/scan.pdf (0.1 MB) contains no extractable text",
    ]);
  });

  it("computes the same fingerprint as node:crypto", () => {
    expect(sha256Of(hello)).toBe(helloSha);
    expect(sha256Of(hello)).toBe(createHash("sha256").update(hello).digest("hex"));
  });

  it("reports W-CONV-FAILED when the conversion exceeds the timeout; the document remains available for download", async () => {
    const { fs, deps } = harness({ kind: "timeout" });
    const output = await convertToPdf(
      { path: "/repo/big.pptx", bytes: hello },
      { ...options, timeoutMs: 1_500 },
      deps,
    );
    expect(output).toEqual({
      representations: {},
      findings: [
        {
          check: "W-CONV-FAILED",
          severity: "warning",
          message: "conversion of /repo/big.pptx failed: timed out after 1.5 s",
          remediation: "reduce the document or raise conversion.timeout_s",
          path: "/repo/big.pptx",
        },
      ],
    });
    expect(fs.listFiles(cacheDirectory)).toEqual([]);
  });

  it("reports W-CONV-FAILED when the source exceeds the maximum size, without running LibreOffice", async () => {
    const { runner, deps } = harness();
    const output = await convertToPdf(
      { path: "/repo/big.xlsx", bytes: new Uint8Array(3 * 1024 * 1024 + 1) },
      { ...options, maxSizeBytes: 3 * 1024 * 1024 },
      deps,
    );
    expect(runner.calls).toEqual([]);
    expect(output).toEqual({
      representations: {},
      findings: [
        {
          check: "W-CONV-FAILED",
          severity: "warning",
          message:
            "conversion of /repo/big.xlsx failed: the document weighs 3.0 MB, above the maximum of 3.0 MB",
          remediation: "reduce the document or raise conversion.max_size_mb",
          path: "/repo/big.xlsx",
        },
      ],
    });
  });

  it("converts a source that weighs exactly the maximum size", async () => {
    const { runner, deps } = harness();
    const output = await convertToPdf(
      { path: "/repo/edge.docx", bytes: new Uint8Array(1024) },
      { ...options, maxSizeBytes: 1024 },
      deps,
    );
    expect(runner.calls).toHaveLength(1);
    expect(output.findings).toEqual([]);
  });

  it("reports W-CONV-FAILED with the exit code and the first line of stderr when LibreOffice fails", async () => {
    const { deps } = harness({
      kind: "exit",
      code: 77,
      stderr: "\n  Error: source file could not be loaded  \nmore details\n",
    });
    const output = await convertToPdf({ path: "/repo/broken.docx", bytes: hello }, options, deps);
    expect(output.representations).toEqual({});
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/broken.docx failed: soffice exited with code 77: Error: source file could not be loaded",
    ]);
    expect(output.findings[0]?.remediation).toBe("check that the document opens in LibreOffice");
  });

  it("reports W-CONV-FAILED without detail when LibreOffice fails silently", async () => {
    const { deps } = harness({ kind: "exit", code: 1, stderr: "" });
    const output = await convertToPdf({ path: "/repo/broken.docx", bytes: hello }, options, deps);
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/broken.docx failed: soffice exited with code 1",
    ]);
  });

  it("reports W-CONV-FAILED when LibreOffice is killed before exiting", async () => {
    const { deps } = harness({ kind: "exit", code: null, stderr: "Killed" });
    const output = await convertToPdf({ path: "/repo/broken.docx", bytes: hello }, options, deps);
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/broken.docx failed: soffice did not exit normally: Killed",
    ]);
  });

  it("reports W-CONV-FAILED when LibreOffice exits cleanly without producing a PDF", async () => {
    const { fs, deps } = harness({ kind: "nothing" });
    const output = await convertToPdf({ path: "/repo/odd.docx", bytes: hello }, options, deps);
    expect(output.findings.map((finding) => finding.message)).toEqual([
      "conversion of /repo/odd.docx failed: soffice produced no PDF",
    ]);
    expect(fs.listFiles(cacheDirectory)).toEqual([]);
  });

  it("reports W-CONV-SUSPECT when a PDF produced from a large document has no extractable text", async () => {
    const { deps, extracted } = harness(undefined, [" \n", "\t"]);
    const bytes = new Uint8Array(SUSPECT_SOURCE_BYTES + 1);
    const output = await convertToPdf({ path: "/repo/scan.pptx", bytes }, options, deps);
    expect(extracted.map((pdf) => [...pdf])).toEqual([[...PDF_BYTES]]);
    expect(output.representations.pdf?.path).toBe(
      `${cacheDirectory}/convert/${sha256Of(bytes)}.pdf`,
    );
    expect(output.findings).toEqual([
      {
        check: "W-CONV-SUSPECT",
        severity: "warning",
        message: "the PDF converted from /repo/scan.pptx (0.1 MB) contains no extractable text",
        remediation:
          "re-export the document with selectable text, or add a markdown twin that carries its content",
        path: "/repo/scan.pptx",
      },
    ]);
  });

  it("reports W-CONV-SUSPECT again on a cache hit, so that a second build carries the same findings", async () => {
    const { runner, deps } = harness(undefined, []);
    const bytes = new Uint8Array(SUSPECT_SOURCE_BYTES + 1);
    const first = await convertToPdf({ path: "/repo/scan.pptx", bytes }, options, deps);
    const second = await convertToPdf({ path: "/repo/scan.pptx", bytes }, options, deps);
    expect(runner.calls).toHaveLength(1);
    expect(second).toEqual(first);
    expect(second.findings.map((finding) => finding.check)).toEqual(["W-CONV-SUSPECT"]);
  });

  it("does not suspect the empty PDF of a small document: a title slide has no text", async () => {
    const { deps, extracted } = harness(undefined, [""]);
    const bytes = new Uint8Array(SUSPECT_SOURCE_BYTES);
    const output = await convertToPdf({ path: "/repo/title.pptx", bytes }, options, deps);
    expect(extracted).toHaveLength(1);
    expect(output.findings).toEqual([]);
    expect(output.representations.text?.path).toBe(textOf(sha256Of(bytes)));
  });

  it("does not report a large document whose PDF carries text", async () => {
    const { deps } = harness(undefined, ["", "Agenda"]);
    const bytes = new Uint8Array(SUSPECT_SOURCE_BYTES + 1);
    const output = await convertToPdf({ path: "/repo/deck.pptx", bytes }, options, deps);
    expect(output.findings).toEqual([]);
  });

  it("keeps the conversion cache and its temporary files in the pipeline cache, never next to the source", async () => {
    const fs = memoryFileSystem({ "/repo/notes.md": "" });
    const writes: string[] = [];
    const runner = fakeRunner(fs);
    const spied = {
      ...fs,
      writeBytes: (path: string, bytes: Uint8Array) => {
        writes.push(path);
        fs.writeBytes(path, bytes);
      },
    };
    const output = await convertToPdf({ path: "/repo/a.docx", bytes: hello }, options, {
      runner,
      fs: spied,
      cacheDirectory,
      extractPages: () => Promise.resolve(["text"]),
    });
    expect(writes).toEqual([
      `${cacheDirectory}/convert/work/${helloSha}/a.docx`,
      `${cacheDirectory}/convert/${helloSha}.pdf`,
    ]);
    expect(fs.listFiles("/repo")).toEqual(["notes.md"]);
    expect(fs.listFiles(cacheDirectory)).toEqual([
      `convert/${helloSha}.pdf`,
      `convert/${helloSha}.text.json`,
    ]);
    expect(output.representations.pdf?.path.startsWith(`${cacheDirectory}/`)).toBe(true);
  });

  it("reports W-CONV-FAILED for an extension outside the declared list, whatever its case", async () => {
    const { runner, deps } = harness();
    const output = await convertToPdf({ path: "/repo/notes.TXT", bytes: hello }, options, deps);
    expect(runner.calls).toEqual([]);
    expect(output).toEqual({
      representations: {},
      findings: [
        {
          check: "W-CONV-FAILED",
          severity: "warning",
          message:
            "conversion of /repo/notes.TXT failed: extension .txt is not converted by this plugin",
          remediation: "declare a converter for .txt, or leave the document as a download",
          path: "/repo/notes.TXT",
        },
      ],
    });
    const upper = await convertToPdf({ path: "/repo/Deck.PPTX", bytes: hello }, options, deps);
    expect(upper.findings).toEqual([]);
  });
});
