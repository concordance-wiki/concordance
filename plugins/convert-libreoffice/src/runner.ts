import { execFile } from "node:child_process";

export interface CommandResult {
  /** Exit code, or null when the process did not exit normally or could not start. */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CommandOptions {
  cwd: string;
  timeoutMs: number;
}

/** Runs a command to completion; injected so that conversions are tested without LibreOffice. */
export interface CommandRunner {
  run(command: string, args: string[], options: CommandOptions): Promise<CommandResult>;
}

export const nodeCommandRunner: CommandRunner = {
  run: (command, args, { cwd, timeoutMs }) =>
    new Promise((resolve) => {
      execFile(
        command,
        args,
        { cwd, timeout: timeoutMs, killSignal: "SIGKILL", encoding: "utf8" },
        (error, stdout, stderr) => {
          if (error === null) {
            resolve({ code: 0, stdout, stderr, timedOut: false });
            return;
          }
          // `killed` is set only when the timeout fired: a signal from elsewhere leaves it false.
          const timedOut = error.killed === true;
          const code = typeof error.code === "number" ? error.code : null;
          // A process that could not start has no stderr; its message says why (ENOENT, EACCES).
          const failure = code === null && !timedOut && stderr === "" ? error.message : stderr;
          resolve({ code, stdout, stderr: failure, timedOut });
        },
      );
    }),
};
