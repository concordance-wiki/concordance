import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commandExists, nodeFileSystem } from "@concordance-wiki/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { convertToPdf } from "../src/convert.js";
import { extractPdfText } from "../src/pdf-text.js";
import { nodeCommandRunner, type CommandRunner } from "../src/runner.js";

const encoder = new TextEncoder();
const soffice = await commandExists("soffice");

// LibreOffice is slow to start and the machine may be loaded.
describe.skipIf(!soffice)("convertToPdf through the installed LibreOffice", () => {
  let cacheDirectory = "";
  beforeEach(() => {
    cacheDirectory = mkdtempSync(join(tmpdir(), "concordance-convert-"));
  });
  afterEach(() => {
    rmSync(cacheDirectory, { recursive: true, force: true });
  });

  it(
    "produces a PDF carrying the text of the source and serves it from the cache afterwards",
    { timeout: 120_000 },
    async () => {
      let calls = 0;
      const runner: CommandRunner = {
        run: (command, args, options) => {
          calls += 1;
          return nodeCommandRunner.run(command, args, options);
        },
      };
      const deps = { runner, fs: nodeFileSystem, cacheDirectory, extractText: extractPdfText };
      const options = { extensions: [".txt"], timeoutMs: 120_000, maxSizeBytes: 1024 * 1024 };
      const source = {
        path: join(cacheDirectory, "source", "sample.txt"),
        bytes: encoder.encode("Hello conversion world\n"),
      };
      const output = await convertToPdf(source, options, deps);
      expect(output.findings).toEqual([]);
      const pdf = output.representations.pdf?.path ?? "";
      expect(pdf.startsWith(join(cacheDirectory, "convert"))).toBe(true);
      expect(nodeFileSystem.exists(pdf)).toBe(true);
      expect(await extractPdfText(nodeFileSystem.readBytes(pdf))).toContain(
        "Hello conversion world",
      );
      expect(nodeFileSystem.listFiles(cacheDirectory)).toEqual([
        `convert/${pdf.split("/").at(-1) ?? ""}`,
      ]);
      expect(calls).toBe(1);
      expect(await convertToPdf(source, options, deps)).toEqual(output);
      expect(calls).toBe(1);
    },
  );
});
