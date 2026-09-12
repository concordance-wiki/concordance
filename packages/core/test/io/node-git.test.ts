import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { nodeGit, parseLog } from "../../src/io/node-git.js";

// Every test spawns several git processes; the default budget is meant for unit tests.
vi.setConfig({ testTimeout: 60_000 });

const root = mkdtempSync(join(tmpdir(), "concordance-git-"));
let clones = 0;

function freshDirectory(): string {
  clones += 1;
  return join(root, `clone-${String(clones)}`);
}

function git(cwd: string, args: string[], date = "2024-06-01T12:00:00Z"): string {
  return execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, LC_ALL: "C" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commit(cwd: string, message: string, date: string, files: Record<string, string>): string {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(cwd, path, ".."), { recursive: true });
    writeFileSync(join(cwd, path), content, "utf8");
  }
  git(cwd, ["add", "--all"]);
  git(cwd, ["commit", "--quiet", "--message", message], date);
  return git(cwd, ["rev-parse", "HEAD"]);
}

interface Origin {
  url: string;
  directory: string;
  first: string;
  second: string;
}

/** Two commits on `main`, the first one tagged `v1`; the second commit rewrites README.md and adds docs/b.md. */
function createOrigin(name: string): Origin {
  const directory = join(root, name);
  mkdirSync(directory);
  git(directory, ["init", "--quiet", "--initial-branch=main"]);
  git(directory, ["config", "user.name", "Test"]);
  git(directory, ["config", "user.email", "test@example.com"]);
  const first = commit(directory, "first", "2024-01-01T00:00:00Z", {
    "README.md": "one\n",
    "docs/a.md": "a\n",
  });
  git(directory, ["tag", "v1"]);
  const second = commit(directory, "second", "2024-02-02T00:00:00Z", {
    "README.md": "two\n",
    "docs/b.md": "b\n",
  });
  return { url: pathToFileURL(directory).href, directory, first, second };
}

let origin: Origin;

beforeAll(() => {
  origin = createOrigin("origin");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("nodeGit.clone", () => {
  it("clones a branch at depth 1 on its tip, creating the parent directories", async () => {
    const directory = join(freshDirectory(), "nested", "repo");
    await nodeGit.clone(origin.url, "main", directory);
    expect(await nodeGit.head(directory)).toBe(origin.second);
    expect(git(directory, ["rev-list", "--count", "HEAD"])).toBe("1");
    expect(git(directory, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("two\n");
  });

  it("clones a tag at depth 1 on the tagged commit", async () => {
    const directory = freshDirectory();
    await nodeGit.clone(origin.url, "v1", directory);
    expect(await nodeGit.head(directory)).toBe(origin.first);
    expect(git(directory, ["rev-list", "--count", "HEAD"])).toBe("1");
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("one\n");
    expect(existsSync(join(directory, "docs/b.md"))).toBe(false);
  });

  it("clones a commit sha at depth 1, detached, with origin set for later updates", async () => {
    const directory = join(freshDirectory(), "nested", "repo");
    await nodeGit.clone(origin.url, origin.first, directory);
    expect(await nodeGit.head(directory)).toBe(origin.first);
    expect(git(directory, ["rev-list", "--count", "HEAD"])).toBe("1");
    expect(git(directory, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("HEAD");
    expect(git(directory, ["remote", "get-url", "origin"])).toBe(origin.url);
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("one\n");
  });

  it("treats a branch whose name merely contains a commit sha as a branch", async () => {
    const own = createOrigin("origin-names");
    const hex = "0123456789abcdef0123456789abcdef01234567";
    for (const branch of [`${hex}-next`, `next-${hex}`]) {
      git(own.directory, ["branch", branch, own.first]);
      const directory = freshDirectory();
      await nodeGit.clone(own.url, branch, directory);
      expect(await nodeGit.head(directory)).toBe(own.first);
      expect(git(directory, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(branch);
    }
  });

  it("rejects an unreachable url with git's explanation", async () => {
    const directory = freshDirectory();
    const url = pathToFileURL(join(root, "missing")).href;
    const failure = await nodeGit.clone(url, "main", directory).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : "";
    expect(message).toMatch(/does not appear to be a git repository/);
    expect(message).toBe(message.trim());
  });

  it("rejects an unknown branch", async () => {
    await expect(nodeGit.clone(origin.url, "nope", freshDirectory())).rejects.toThrow(
      /Remote branch nope not found/,
    );
  });

  it("rejects an unknown commit sha", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    await expect(nodeGit.clone(origin.url, sha, freshDirectory())).rejects.toThrow(
      /not our ref|Could not find remote ref|couldn't find remote ref|not found/,
    );
  });
});

describe("nodeGit.update", () => {
  it("moves a branch clone to the new tip at depth 1 and is idempotent", async () => {
    const own = createOrigin("origin-update");
    const directory = freshDirectory();
    await nodeGit.clone(own.url, "main", directory);
    const third = commit(own.directory, "third", "2024-03-03T00:00:00Z", { "docs/c.md": "c\n" });

    await nodeGit.update(directory, "main");
    expect(await nodeGit.head(directory)).toBe(third);
    expect(git(directory, ["rev-list", "--count", "HEAD"])).toBe("1");
    expect(readFileSync(join(directory, "docs/c.md"), "utf8")).toBe("c\n");

    await nodeGit.update(directory, "main");
    expect(await nodeGit.head(directory)).toBe(third);
    expect(git(directory, ["status", "--porcelain"])).toBe("");
  });

  it("moves a clone to a tag or a commit sha", async () => {
    const directory = freshDirectory();
    await nodeGit.clone(origin.url, "main", directory);

    await nodeGit.update(directory, "v1");
    expect(await nodeGit.head(directory)).toBe(origin.first);
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("one\n");

    await nodeGit.update(directory, origin.second);
    expect(await nodeGit.head(directory)).toBe(origin.second);
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("two\n");
  });

  it("discards local modifications so that the clone matches the tip", async () => {
    const directory = freshDirectory();
    await nodeGit.clone(origin.url, "main", directory);
    writeFileSync(join(directory, "README.md"), "edited\n", "utf8");
    await nodeGit.update(directory, "main");
    expect(readFileSync(join(directory, "README.md"), "utf8")).toBe("two\n");
  });
});

describe("nodeGit.head", () => {
  it("rejects outside a repository", async () => {
    const directory = freshDirectory();
    mkdirSync(directory);
    await expect(nodeGit.head(directory)).rejects.toThrow(/not a git repository/);
  });
});

describe("parseLog", () => {
  const newer = "1111111111111111111111111111111111111111 2024-02-02T00:00:00Z";
  const older = "0000000000000000000000000000000000000000 2024-01-01T00:00:00Z";
  const entry = (header: string) => ({ commit: header.slice(0, 40), modifiedAt: header.slice(41) });

  it("returns an empty map for an empty log", () => {
    expect(parseLog("")).toEqual(new Map());
  });

  it("keeps the newest commit of each path and skips commits without files", () => {
    const log = `${newer}\0\nREADME.md\0docs/b.md\0${older}\0${older}\0\nREADME.md\0docs/a.md\0`;
    expect([...parseLog(log)]).toEqual([
      ["README.md", entry(newer)],
      ["docs/b.md", entry(newer)],
      ["docs/a.md", entry(older)],
    ]);
  });

  it("does not mistake a path that starts or ends like a header for one", () => {
    const log = `${newer}\0\nREADME.md\0${older} tail.md\0x${older}\0`;
    expect([...parseLog(log)]).toEqual([
      ["README.md", entry(newer)],
      [`${older} tail.md`, entry(newer)],
      [`x${older}`, entry(newer)],
    ]);
  });

  it("strips only the newline that introduces the first path of a commit", () => {
    const log = `${newer}\0\nfirst\nline.md\0second\nline.md\0`;
    expect([...parseLog(log).keys()]).toEqual(["first\nline.md", "second\nline.md"]);
  });
});

describe("nodeGit.history", () => {
  it("maps every file of a depth-1 clone to the head commit and its date, in path order", async () => {
    const directory = freshDirectory();
    await nodeGit.clone(origin.url, "main", directory);
    const history = await nodeGit.history(directory);
    const head = { commit: origin.second, modifiedAt: "2024-02-02T00:00:00Z" };
    expect([...history]).toEqual([
      ["README.md", head],
      ["docs/a.md", head],
      ["docs/b.md", head],
    ]);
  });

  it("maps each file of a full clone to the last commit that touched it", async () => {
    const directory = freshDirectory();
    git(root, ["clone", "--quiet", origin.url, directory]);
    const history = await nodeGit.history(directory);
    expect([...history]).toEqual([
      ["README.md", { commit: origin.second, modifiedAt: "2024-02-02T00:00:00Z" }],
      ["docs/a.md", { commit: origin.first, modifiedAt: "2024-01-01T00:00:00Z" }],
      ["docs/b.md", { commit: origin.second, modifiedAt: "2024-02-02T00:00:00Z" }],
    ]);
  });

  it("keeps file names that look like log headers and orders paths by code unit", async () => {
    const own = createOrigin("origin-odd-names");
    const hex = "0123456789abcdef0123456789abcdef01234567";
    const odd = commit(own.directory, "odd", "2024-03-03T00:00:00Z", {
      [`${hex} not a header.md`]: "",
      [`z${hex} 2024-03-03T00:00:00Z`]: "",
      "zz.md": "",
      "\u{1F600}.md": "",
      "\uFF01.md": "",
    });
    const directory = freshDirectory();
    await nodeGit.clone(own.url, "main", directory);
    const history = await nodeGit.history(directory);
    const head = { commit: odd, modifiedAt: "2024-03-03T00:00:00Z" };
    expect([...history]).toEqual([
      [`${hex} not a header.md`, head],
      ["README.md", head],
      ["docs/a.md", head],
      ["docs/b.md", head],
      [`z${hex} 2024-03-03T00:00:00Z`, head],
      ["zz.md", head],
      ["\u{1F600}.md", head],
      ["\uFF01.md", head],
    ]);
  });

  it("ignores deleted files and attributes a file created by a merge to that merge", async () => {
    const own = createOrigin("origin-merge");
    git(own.directory, ["checkout", "--quiet", "-b", "side", own.first]);
    const side = commit(own.directory, "side", "2024-03-03T00:00:00Z", { "side.md": "s\n" });
    git(own.directory, ["checkout", "--quiet", "main"]);
    git(own.directory, ["rm", "--quiet", "docs/b.md"]);
    git(own.directory, ["commit", "--quiet", "--message", "delete"], "2024-04-04T00:00:00Z");
    git(own.directory, ["merge", "--quiet", "--no-commit", "--no-ff", "side"]);
    const merge = commit(own.directory, "merge", "2024-05-05T00:00:00Z", { "merged.md": "m\n" });
    expect(git(own.directory, ["rev-list", "--parents", "-1", "HEAD"]).split(" ")).toHaveLength(3);

    const directory = freshDirectory();
    git(root, ["clone", "--quiet", own.url, directory]);
    const history = await nodeGit.history(directory);
    expect([...history]).toEqual([
      ["README.md", { commit: own.second, modifiedAt: "2024-02-02T00:00:00Z" }],
      ["docs/a.md", { commit: own.first, modifiedAt: "2024-01-01T00:00:00Z" }],
      ["merged.md", { commit: merge, modifiedAt: "2024-05-05T00:00:00Z" }],
      ["side.md", { commit: side, modifiedAt: "2024-03-03T00:00:00Z" }],
    ]);
  });
});
