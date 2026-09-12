import { execFile } from "node:child_process";

/** True when `<command> --version` exits with 0; a missing command or a failing one both read as absent. */
export function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ["--version"], (error) => {
      resolve(error === null);
    });
  });
}
