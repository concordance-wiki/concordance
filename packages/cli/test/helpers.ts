import {
  fixedClock,
  memoryFileSystem,
  type FileHistory,
  type GitClient,
} from "@concordance-wiki/core";

import type { CommandIo } from "../src/io.js";

export interface RecordedIo extends CommandIo {
  fs: ReturnType<typeof memoryFileSystem>;
  git: FakeGit;
  stdout: string[];
  stderr: string[];
}

/** One local source filed under a declared application, every note filed under one domain. */
export const validConfig = [
  "version: 1",
  "project: { name: Wiki }",
  "applications: [{ id: wiki }]",
  "domains: [{ id: notes, match: ['**/*.md'] }]",
  "sources: [{ name: notes, path: ./notes, application: wiki }]",
  "",
].join("\n");

/** A git client that materialises a fixed file into the clone directory and fails on demand. */
export class FakeGit implements GitClient {
  readonly calls: string[] = [];
  failing = new Set<string>();

  constructor(private readonly fs: ReturnType<typeof memoryFileSystem>) {}

  clone(url: string, ref: string, directory: string): Promise<void> {
    this.calls.push(`clone ${url} ${ref} ${directory}`);
    if (this.failing.has(url)) {
      return Promise.reject(new Error(`fatal: repository '${url}' not found`));
    }
    this.fs.writeText(`${directory}/README.md`, "# cloned\n");
    return Promise.resolve();
  }

  update(directory: string, ref: string): Promise<void> {
    this.calls.push(`update ${directory} ${ref}`);
    return Promise.resolve();
  }

  head(): Promise<string> {
    return Promise.resolve("0123456789abcdef0123456789abcdef01234567");
  }

  history(): Promise<Map<string, FileHistory>> {
    return Promise.resolve(
      new Map([
        [
          "README.md",
          {
            commit: "0123456789abcdef0123456789abcdef01234567",
            modifiedAt: "2026-01-02T03:04:05Z",
          },
        ],
      ]),
    );
  }
}

export function recordedIo(files: Record<string, string> = {}, cwd = "/work"): RecordedIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fs = memoryFileSystem(files);
  return {
    fs,
    git: new FakeGit(fs),
    clock: fixedClock("2026-09-12T12:00:00Z"),
    cwd,
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  };
}

const pdfEncoder = new TextEncoder();

/** A minimal PDF, one page per content stream, small enough to be read by pdf.js in a test. */
export function tinyPdf(pages: readonly string[]): Uint8Array {
  const kids = pages.map((_, index) => `${String(4 + index * 2)} 0 R`).join(" ");
  const objects = pages.flatMap((text, index) => {
    const page = 4 + index * 2;
    const content = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    return [
      `${String(page)} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 2000 200] /Contents ${String(page + 1)} 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj`,
      `${String(page + 1)} 0 obj << /Length ${String(content.length)} >> stream\n${content}\nendstream endobj`,
    ];
  });
  return pdfEncoder.encode(
    [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >> endobj`,
      "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      ...objects,
      "trailer << /Root 1 0 R >>",
      "%%EOF",
    ].join("\n"),
  );
}
