import { createHash } from "node:crypto";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ConverterOutput, FileSystem, Finding } from "@concordance-wiki/core";

import type { CommandRunner } from "./runner.js";

export interface ConvertSource {
  path: string;
  bytes: Uint8Array;
  /** Hex SHA-256 of the bytes; computed when the caller does not provide it. */
  sha256?: string;
}

export interface ConvertOptions {
  /** Lowercase extensions, each starting with `.`, that the converter accepts. */
  extensions: readonly string[];
  timeoutMs: number;
  maxSizeBytes: number;
}

export interface ConvertDependencies {
  runner: CommandRunner;
  fs: FileSystem;
  /** Text of a produced PDF; empty when nothing can be extracted. */
  extractText: (pdf: Uint8Array) => Promise<string>;
  /** Folder of the pipeline cache; the converted PDFs and the temporary folders live under `convert/`. */
  cacheDirectory: string;
}

/** Below this source size, a PDF without text is not suspect: a title slide or an empty sheet has none. */
export const SUSPECT_SOURCE_BYTES = 100 * 1024;

export const SOFFICE = "soffice";

export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function failed(path: string, reason: string, remediation: string): ConverterOutput {
  const finding: Finding = {
    check: "W-CONV-FAILED",
    severity: "warning",
    message: `conversion of ${path} failed: ${reason}`,
    remediation,
    path,
  };
  return { representations: {}, findings: [finding] };
}

function firstLine(text: string): string {
  const line = text.split("\n").find((candidate) => candidate.trim() !== "");
  return line === undefined ? "" : line.trim();
}

function describeExit(code: number | null, stderr: string): string {
  const exit =
    code === null
      ? `${SOFFICE} did not exit normally`
      : `${SOFFICE} exited with code ${String(code)}`;
  const detail = firstLine(stderr);
  return detail === "" ? exit : `${exit}: ${detail}`;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function produce(
  source: ConvertSource,
  work: string,
  options: ConvertOptions,
  deps: ConvertDependencies,
): Promise<{ pdf: Uint8Array } | { failure: ConverterOutput }> {
  const name = basename(source.path);
  const input = join(work, name);
  const output = join(work, `${name.slice(0, name.length - extname(name).length)}.pdf`);
  deps.fs.writeBytes(input, source.bytes);
  // Each run gets its own user profile: parallel instances sharing the default one block each other.
  const profile = pathToFileURL(join(work, "profile")).href;
  const result = await deps.runner.run(
    SOFFICE,
    [
      "--headless",
      "--norestore",
      `-env:UserInstallation=${profile}`,
      "--convert-to",
      "pdf",
      "--outdir",
      work,
      input,
    ],
    { cwd: work, timeoutMs: options.timeoutMs },
  );
  if (result.timedOut) {
    return {
      failure: failed(
        source.path,
        `timed out after ${String(options.timeoutMs / 1000)} s`,
        "reduce the document or raise conversion.timeout_s",
      ),
    };
  }
  if (result.code !== 0) {
    return {
      failure: failed(
        source.path,
        describeExit(result.code, result.stderr),
        "check that the document opens in LibreOffice",
      ),
    };
  }
  if (!deps.fs.exists(output)) {
    return {
      failure: failed(
        source.path,
        `${SOFFICE} produced no PDF`,
        "check that the document opens in LibreOffice",
      ),
    };
  }
  return { pdf: deps.fs.readBytes(output) };
}

async function suspectFindings(
  source: ConvertSource,
  pdf: Uint8Array,
  deps: ConvertDependencies,
): Promise<Finding[]> {
  if (source.bytes.byteLength <= SUSPECT_SOURCE_BYTES) {
    return [];
  }
  const text = await deps.extractText(pdf);
  if (text.trim() !== "") {
    return [];
  }
  return [
    {
      check: "W-CONV-SUSPECT",
      severity: "warning",
      message: `the PDF converted from ${source.path} (${megabytes(source.bytes.byteLength)} MB) contains no extractable text`,
      remediation:
        "re-export the document with selectable text, or add a markdown twin that carries its content",
      path: source.path,
    },
  ];
}

/**
 * Converts one office document to PDF through headless LibreOffice, keyed in the cache by the
 * SHA-256 of the source: an unchanged source is never reconverted. Every failure is a finding.
 */
export async function convertToPdf(
  source: ConvertSource,
  options: ConvertOptions,
  deps: ConvertDependencies,
): Promise<ConverterOutput> {
  const extension = extname(source.path).toLowerCase();
  if (!options.extensions.includes(extension)) {
    return failed(
      source.path,
      `extension ${extension} is not converted by this plugin`,
      `declare a converter for ${extension}, or leave the document as a download`,
    );
  }
  if (source.bytes.byteLength > options.maxSizeBytes) {
    return failed(
      source.path,
      `the document weighs ${megabytes(source.bytes.byteLength)} MB, above the maximum of ${megabytes(options.maxSizeBytes)} MB`,
      "reduce the document or raise conversion.max_size_mb",
    );
  }
  const sha256 = source.sha256 ?? sha256Of(source.bytes);
  const cached = join(deps.cacheDirectory, "convert", `${sha256}.pdf`);
  let pdf: Uint8Array;
  if (deps.fs.exists(cached)) {
    pdf = deps.fs.readBytes(cached);
  } else {
    const work = join(deps.cacheDirectory, "convert", "work", sha256);
    const produced = await produce(source, work, options, deps);
    deps.fs.remove(work);
    if ("failure" in produced) {
      return produced.failure;
    }
    pdf = produced.pdf;
    deps.fs.writeBytes(cached, pdf);
  }
  return {
    representations: { pdf: { path: cached } },
    findings: await suspectFindings(source, pdf, deps),
  };
}
