import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The directories an executable is looked up in, never the `PATH` of the process: the system
 * folders of each platform, so that a folder a build could write to never supplies a command.
 * An environment variable named after the command (`CONCORDANCE_GIT`) names another location.
 */
const LINUX_DIRECTORIES = ["/usr/local/bin", "/usr/bin", "/bin"];

export const TRUSTED_DIRECTORIES: Readonly<Record<string, readonly string[]>> = {
  win32: [
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files\\Git\\bin",
    "C:\\Program Files (x86)\\Git\\cmd",
    "C:\\Windows\\System32",
  ],
  darwin: ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"],
  linux: LINUX_DIRECTORIES,
};

/** The variable that overrides the location of a command: `CONCORDANCE_GIT` for `git`. */
export function overrideVariable(command: string): string {
  return `CONCORDANCE_${command.toUpperCase().replace(/[^A-Z0-9]/gu, "_")}`;
}

/**
 * The absolute path of a command: the override variable when set, else the first trusted
 * directory of the platform holding it (`.exe` on Windows). Undefined when none holds it.
 */
export function locateExecutable(
  command: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: string = process.platform,
): string | undefined {
  const override = env[overrideVariable(command)];
  if (override !== undefined && override !== "") return override;
  const name = platform === "win32" ? `${command}.exe` : command;
  // Another platform (a BSD, for instance) reads as Linux.
  for (const directory of TRUSTED_DIRECTORIES[platform] ?? LINUX_DIRECTORIES) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** The absolute path of a command, or an error naming the variable that would give it. */
export function requireExecutable(
  command: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform: string = process.platform,
): string {
  const located = locateExecutable(command, env, platform);
  if (located === undefined) {
    throw new Error(
      `${command} was not found in the system directories; set ${overrideVariable(command)} to its path`,
    );
  }
  return located;
}
