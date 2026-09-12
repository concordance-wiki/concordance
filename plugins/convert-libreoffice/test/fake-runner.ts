import { basename, join } from "node:path";

import type { FileSystem } from "@concordance-wiki/core";

import type { CommandOptions, CommandResult, CommandRunner } from "../src/runner.js";

export interface RecordedCall {
  command: string;
  args: string[];
  options: CommandOptions;
}

export type Behaviour =
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "exit"; code: number | null; stderr: string }
  | { kind: "timeout" }
  | { kind: "nothing" };

const encoder = new TextEncoder();

export const PDF_BYTES = encoder.encode("%PDF-1.4 fake");

/** Plays LibreOffice: writes the PDF where `--outdir` says, fails, hangs past the timeout, or exits silently. */
export function fakeRunner(
  fs: FileSystem,
  behaviour: Behaviour = { kind: "pdf", bytes: PDF_BYTES },
): CommandRunner & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    run: (command, args, options) => {
      calls.push({ command, args, options });
      const outdir = args[args.indexOf("--outdir") + 1] ?? "";
      const input = args[args.length - 1] ?? "";
      const ok: CommandResult = { code: 0, stdout: "convert", stderr: "", timedOut: false };
      switch (behaviour.kind) {
        case "pdf":
          fs.writeBytes(
            join(outdir, `${basename(input).replace(/\.[^.]+$/, "")}.pdf`),
            behaviour.bytes,
          );
          return Promise.resolve(ok);
        case "exit":
          return Promise.resolve({
            code: behaviour.code,
            stdout: "",
            stderr: behaviour.stderr,
            timedOut: false,
          });
        case "timeout":
          return Promise.resolve({ code: null, stdout: "", stderr: "", timedOut: true });
        case "nothing":
          return Promise.resolve(ok);
      }
    },
  };
}
