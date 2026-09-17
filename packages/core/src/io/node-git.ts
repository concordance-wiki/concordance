import { execFile } from "node:child_process";

import { requireExecutable } from "./executable.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { FileHistory, GitClient } from "./git.js";

const commitSha = /^[0-9a-f]{40}$/;
// A log header is "<sha> <committer date>"; NUL cannot appear in a path, so `-z` output splits cleanly on it.
const logHeader = /^[0-9a-f]{40} \S+$/;
const logFormat = "--format=%H %cI";
// The history without the blobs: `git log` walks the commits and the trees, the checkout fetches the files it needs.
const promisor = "--filter=blob:none";
// Large enough for `git log --name-only` over a deep history; the default of 1 MiB is not.
const maxBuffer = 536870912;
/** The variable that bounds one git command, in seconds; a transfer that stalls fails rather than holds the build. */
export const GIT_TIMEOUT_VARIABLE = "CONCORDANCE_GIT_TIMEOUT";
const DEFAULT_GIT_TIMEOUT_SECONDS = 900;

/** The seconds one git command may take: the variable when it holds a positive number, else fifteen minutes. */
export function gitTimeoutSeconds(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const given = Number(env[GIT_TIMEOUT_VARIABLE]);
  return Number.isFinite(given) && given > 0 ? given : DEFAULT_GIT_TIMEOUT_SECONDS;
}

/**
 * The environment git runs in: never a prompt. The terminal prompt is disabled so that a private
 * repository fails instead of waiting for credentials; Git Credential Manager is told the same
 * (`GCM_INTERACTIVE`), and ssh runs in batch mode unless the caller names its own command, so that
 * a passphrase or an unknown host key fails instead of opening a dialog.
 */
export function gitEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string | undefined> {
  const ssh =
    env["GIT_SSH_COMMAND"] === undefined && env["GIT_SSH"] === undefined
      ? { GIT_SSH_COMMAND: "ssh -o BatchMode=yes" }
      : {};
  return { ...env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never", LC_ALL: "C", ...ssh };
}

function git(cwd: string, args: readonly string[]): Promise<string> {
  const timeout = gitTimeoutSeconds();
  return new Promise((resolve, reject) => {
    execFile(
      requireExecutable("git"),
      [...args],
      { cwd, env: gitEnvironment(), maxBuffer, timeout: timeout * 1000 },
      (error, stdout) => {
        if (error === null) {
          resolve(stdout);
        } else if (error.killed) {
          reject(
            new Error(
              `git ${args.join(" ")} took more than ${String(timeout)} s and was stopped; set ${GIT_TIMEOUT_VARIABLE} to allow more`,
            ),
          );
        } else {
          // The message names the command and ends with git's stderr, which explains the failure.
          reject(new Error(error.message.trim()));
        }
      },
    );
  });
}

// Code-unit order, not locale order: the output must not depend on the collation data of the runtime.
function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function parseHeader(line: string): FileHistory {
  return { commit: line.slice(0, 40), modifiedAt: line.slice(41) };
}

/** Newest commit per path, from `git log --name-only -z` output; the first path of each commit starts with "\n". */
export function parseLog(output: string): Map<string, FileHistory> {
  const touched = new Map<string, FileHistory>();
  let current = parseHeader("");
  for (const token of output.split("\0")) {
    if (logHeader.test(token)) {
      current = parseHeader(token);
      continue;
    }
    const path = token.replace(/^\n/, "");
    if (path !== "" && !touched.has(path)) {
      touched.set(path, current);
    }
  }
  return touched;
}

/** Whether the clone was made at a fixed depth, as earlier versions did, so that its history stops short. */
async function isShallow(directory: string): Promise<boolean> {
  return (await git(directory, ["rev-parse", "--is-shallow-repository"])).trim() === "true";
}

async function fetchAndCheckout(directory: string, ref: string): Promise<void> {
  const unshallow = (await isShallow(directory)) ? ["--unshallow"] : [];
  // `--end-of-options`: a ref or a URL from the configuration is never read as an option by git.
  await git(directory, ["fetch", promisor, ...unshallow, "--end-of-options", "origin", ref]);
  await git(directory, ["checkout", "--detach", "--force", "--quiet", "FETCH_HEAD"]);
}

/** Every path of the working tree that differs from the head: modified, added, deleted or untracked, relative to the repository root. */
export function parseStatus(output: string): Set<string> {
  return new Set(
    output
      .split("\0")
      .filter((entry) => entry.length > 3)
      .map((entry) => entry.slice(3)),
  );
}

// A merge commit lists no file in `git log --name-only`, so a file created by a merge is looked up on its own.
async function lastCommit(directory: string, path: string): Promise<FileHistory> {
  return parseHeader((await git(directory, ["log", "-1", logFormat, "--", path])).trim());
}

export const nodeGit: GitClient = {
  clone: async (url, ref, directory) => {
    if (commitSha.test(ref)) {
      mkdirSync(directory, { recursive: true });
      await git(directory, ["init", "--quiet"]);
      await git(directory, ["remote", "add", "--end-of-options", "origin", url]);
      await fetchAndCheckout(directory, ref);
      return;
    }
    const parent = dirname(directory);
    mkdirSync(parent, { recursive: true });
    await git(parent, [
      "clone",
      "--quiet",
      promisor,
      "--branch",
      ref,
      "--single-branch",
      "--end-of-options",
      url,
      directory,
    ]);
  },
  update: (directory, ref) => fetchAndCheckout(directory, ref),
  head: async (directory) => (await git(directory, ["rev-parse", "HEAD"])).trim(),
  history: async (directory) => {
    // Rename detection would compare blob contents, which a promisor clone fetches one by one.
    const [tree, log] = await Promise.all([
      git(directory, ["ls-tree", "-r", "-z", "--name-only", "HEAD"]),
      git(directory, ["log", logFormat, "--name-only", "--no-renames", "-z"]),
    ]);
    const touched = parseLog(log);
    const history = new Map<string, FileHistory>();
    const tracked = tree
      .split("\0")
      .filter((entry) => entry !== "")
      .sort(byCodeUnit);
    for (const path of tracked) {
      history.set(path, touched.get(path) ?? (await lastCommit(directory, path)));
    }
    return history;
  },
  localHistory: async (directory) => {
    let top: string;
    let prefix: string;
    try {
      top = (await git(directory, ["rev-parse", "--show-toplevel"])).trim();
      prefix = (await git(directory, ["rev-parse", "--show-prefix"])).trim();
      await git(top, ["rev-parse", "--verify", "--quiet", "HEAD"]);
    } catch {
      return undefined;
    }
    const status = await git(top, [
      "status",
      "--porcelain=v1",
      "-z",
      "--no-renames",
      "--untracked-files=all",
    ]);
    const changed = parseStatus(status);
    const history = new Map<string, FileHistory>();
    for (const [path, entry] of await nodeGit.history(top)) {
      if (path.startsWith(prefix) && !changed.has(path)) {
        history.set(path.slice(prefix.length), entry);
      }
    }
    return history;
  },
};
