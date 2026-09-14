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

function git(cwd: string, args: readonly string[]): Promise<string> {
  // The terminal prompt is disabled so that a private repository fails instead of waiting for credentials.
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
  return new Promise((resolve, reject) => {
    execFile(requireExecutable("git"), [...args], { cwd, env, maxBuffer }, (error, stdout) => {
      if (error === null) {
        resolve(stdout);
      } else {
        // The message names the command and ends with git's stderr, which explains the failure.
        reject(new Error(error.message.trim()));
      }
    });
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
  await git(directory, ["fetch", promisor, ...unshallow, "origin", ref]);
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
      await git(directory, ["remote", "add", "origin", url]);
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
