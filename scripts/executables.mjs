// The commands the scripts run, located by an absolute path and never by a name looked up on
// the PATH: pnpm is the one running the script (`npm_execpath`), else the one of PNPM_HOME, else
// the corepack shipped next to node; git comes from the system directories of the platform, or
// from CONCORDANCE_GIT (the same rule the core package applies at build time).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const TRUSTED = {
  win32: [
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files\\Git\\bin",
    "C:\\Program Files (x86)\\Git\\cmd",
    "C:\\Windows\\System32",
  ],
  darwin: ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"],
  linux: ["/usr/local/bin", "/usr/bin", "/bin"],
};

/** `[command, ...leading arguments]` for pnpm: node with pnpm's entry file, or an absolute binary. */
export function pnpmCommand(env = process.env, execPath = process.execPath) {
  const running = env["npm_execpath"];
  if (running !== undefined && running.endsWith("pnpm.cjs")) return [execPath, running];
  const home = env["PNPM_HOME"];
  if (home !== undefined && existsSync(join(home, "pnpm"))) return [join(home, "pnpm")];
  return [join(dirname(execPath), "corepack"), "pnpm"];
}

/** The absolute path of a system command, from its override variable or a trusted directory. */
export function systemCommand(command, env = process.env, platform = process.platform) {
  const variable = `CONCORDANCE_${command.toUpperCase().replace(/[^A-Z0-9]/gu, "_")}`;
  const override = env[variable];
  if (override !== undefined && override !== "") return override;
  const name = platform === "win32" ? `${command}.exe` : command;
  for (const directory of TRUSTED[platform] ?? TRUSTED.linux) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `${command} was not found in the system directories; set ${variable} to its path`,
  );
}
