import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { FileHistory, GitClient } from "./git.js";

const commitSha = /^[0-9a-f]{40}$/;
// A log header is "<sha> <committer date>"; NUL cannot appear in a path, so `-z` output splits cleanly on it.
const logHeader = /^[0-9a-f]{40} \S+$/;
const logFormat = "--format=%H %cI";
// Large enough for `git log --name-only` over a deep history; the default of 1 MiB is not.
const maxBuffer = 536870912;

function git(cwd: string, args: readonly string[]): Promise<string> {
  // The terminal prompt is disabled so that a private repository fails instead of waiting for credentials.
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
  return new Promise((resolve, reject) => {
    execFile("git", [...args], { cwd, env, maxBuffer }, (error, stdout) => {
      if (error === null) {
        resolve(stdout);
      } else {
        // The message names the command and ends with git's stderr, which explains the failure.
        reject(new Error(error.message.trim()));
      }
    });
  });
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

async function fetchAndCheckout(directory: string, ref: string): Promise<void> {
  await git(directory, ["fetch", "--depth", "1", "origin", ref]);
  await git(directory, ["checkout", "--detach", "--force", "--quiet", "FETCH_HEAD"]);
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
      "--depth",
      "1",
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
    const [tree, log] = await Promise.all([
      git(directory, ["ls-tree", "-r", "-z", "--name-only", "HEAD"]),
      git(directory, ["log", logFormat, "--name-only", "-z"]),
    ]);
    const touched = parseLog(log);
    const history = new Map<string, FileHistory>();
    const tracked = tree.split("\0").filter((entry) => entry !== "");
    for (const path of tracked.sort()) {
      history.set(path, touched.get(path) ?? (await lastCommit(directory, path)));
    }
    return history;
  },
};
