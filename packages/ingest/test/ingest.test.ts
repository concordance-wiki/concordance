import {
  memoryFileSystem,
  type Config,
  type FileSystem,
  type MemoryFileSystem,
  type SourceConfig,
} from "@concordance-wiki/core";
import { describe, expect, it, vi } from "vitest";

import { ingestSources } from "../src/ingest.js";
import type { IngestDependencies } from "../src/types.js";
import { FakeGit, type FakeRepository } from "./fake-git.js";

const CACHE = "/cache";
const CONFIG_DIRECTORY = "/project";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const URL = "https://example.invalid/docs.git";

const docs: FakeRepository = {
  commit: COMMIT,
  files: {
    "guide/setup.md": {
      content: "# Setup\n",
      history: {
        commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        modifiedAt: "2024-03-01T10:00:00.000Z",
      },
    },
    "README.md": {
      content: "# Docs\n",
      history: { commit: COMMIT, modifiedAt: "2024-05-02T08:30:00.000Z" },
    },
  },
};

function config(sources: SourceConfig[], overrides: Partial<Config> = {}): Config {
  return { version: 1, project: { name: "Wiki" }, sources, ...overrides };
}

interface Harness {
  fs: MemoryFileSystem;
  git: FakeGit;
  deps: IngestDependencies;
}

function harness(remotes: Record<string, FakeRepository> = { [URL]: docs }): Harness {
  const fs = memoryFileSystem();
  const git = new FakeGit(fs, remotes);
  return { fs, git, deps: { fs, git, cacheDirectory: CACHE, configDirectory: CONFIG_DIRECTORY } };
}

const unreachable = (name: string, message: string) => ({
  check: "W-SOURCE-UNREACHABLE",
  severity: "warning",
  source: name,
  message,
  remediation:
    "Check the URL, the ref and the credentials of the pipeline; the source is skipped in this build.",
});

describe("ingestSources", () => {
  describe("git sources", () => {
    it("clones at depth 1 on the declared ref, main by default", async () => {
      const { git, deps } = harness();
      await ingestSources(config([{ name: "docs", git: URL }]), deps);
      expect(git.calls).toEqual([
        `clone ${URL} main ${CACHE}/sources/docs`,
        `head ${CACHE}/sources/docs`,
        `history ${CACHE}/sources/docs`,
      ]);
    });

    it("passes an explicit ref through to the clone", async () => {
      const { git, deps } = harness();
      await ingestSources(config([{ name: "docs", git: URL, ref: "release/2024" }]), deps);
      expect(git.calls[0]).toBe(`clone ${URL} release/2024 ${CACHE}/sources/docs`);
    });

    it("updates an already cached clone instead of cloning again", async () => {
      const { git, deps } = harness();
      git.cached(`${CACHE}/sources/docs`, docs);
      const result = await ingestSources(config([{ name: "docs", git: URL, ref: "v2" }]), deps);
      expect(git.calls).toEqual([
        `update ${CACHE}/sources/docs v2`,
        `head ${CACHE}/sources/docs`,
        `history ${CACHE}/sources/docs`,
      ]);
      expect(result.sources.map((source) => source.commit)).toEqual([COMMIT]);
    });

    it("writes nothing into source repositories: only the cache directory is touched", async () => {
      const { fs, deps } = harness();
      await ingestSources(config([{ name: "docs", git: URL }]), deps);
      const written = [...fs.files.keys()];
      expect(written).toHaveLength(2);
      expect(written.every((path) => path.startsWith(`${CACHE}/sources/docs/`))).toBe(true);
    });

    it("records the exact commit and last-modified date of every file", async () => {
      const { deps } = harness();
      const result = await ingestSources(config([{ name: "docs", git: URL }]), deps);
      expect(result).toEqual({
        findings: [],
        sources: [
          {
            name: "docs",
            locale: "en",
            root: `${CACHE}/sources/docs`,
            commit: COMMIT,
            files: [
              {
                path: "README.md",
                absolutePath: `${CACHE}/sources/docs/README.md`,
                commit: COMMIT,
                modifiedAt: "2024-05-02T08:30:00.000Z",
              },
              {
                path: "guide/setup.md",
                absolutePath: `${CACHE}/sources/docs/guide/setup.md`,
                commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                modifiedAt: "2024-03-01T10:00:00.000Z",
              },
            ],
          },
        ],
      });
    });

    it("stamps an untracked file with the source commit and the file system date", async () => {
      const { deps } = harness({
        [URL]: {
          commit: COMMIT,
          files: { "draft.md": { content: "wip", modifiedAt: "2024-06-01T00:00:00.000Z" } },
        },
      });
      const result = await ingestSources(config([{ name: "docs", git: URL }]), deps);
      expect(result.sources[0]?.files).toEqual([
        {
          path: "draft.md",
          absolutePath: `${CACHE}/sources/docs/draft.md`,
          commit: COMMIT,
          modifiedAt: "2024-06-01T00:00:00.000Z",
        },
      ]);
    });

    it("sorts files by path whatever order the file system lists them in", async () => {
      const { fs, deps } = harness();
      const listing = ["z.md", "a/b.md", "m.md"];
      const shuffled: FileSystem = { ...fs, listFiles: () => listing };
      const result = await ingestSources(config([{ name: "docs", git: URL }]), {
        ...deps,
        fs: shuffled,
      });
      expect(result.sources[0]?.files.map((file) => file.path)).toEqual(["a/b.md", "m.md", "z.md"]);
    });
  });

  describe("unreachable sources", () => {
    it("yields a finding for a repository that cannot be cloned and no files for that source", async () => {
      const { deps } = harness({});
      const result = await ingestSources(config([{ name: "docs", git: URL }]), deps);
      expect(result).toEqual({
        sources: [],
        findings: [
          unreachable(
            "docs",
            `source "docs" could not be fetched: fatal: repository '${URL}' not found`,
          ),
        ],
      });
    });

    it.each(["update", "head", "history"] as const)(
      "yields a finding when %s fails on a cached clone",
      async (operation) => {
        const { git, deps } = harness();
        git.cached(`${CACHE}/sources/docs`, docs);
        git.fail(operation, `${CACHE}/sources/docs`, new Error(`${operation} exploded`));
        const result = await ingestSources(config([{ name: "docs", git: URL }]), deps);
        expect(result.sources).toEqual([]);
        expect(result.findings.map((finding) => finding.message)).toEqual([
          `source "docs" could not be fetched: ${operation} exploded`,
        ]);
      },
    );

    it.each([
      "fatal: Authentication failed for 'https://example.invalid/docs.git/'",
      "fatal: could not read Username for 'https://example.invalid': terminal prompts disabled",
      "git@example.invalid: Permission denied (publickey).",
    ])("names missing credentials when git says %s", async (stderr) => {
      const { git, deps } = harness();
      git.fail("clone", URL, new Error(stderr));
      const [finding] = (await ingestSources(config([{ name: "docs", git: URL }]), deps)).findings;
      expect(finding?.message).toBe(
        `source "docs" could not be fetched: ${stderr}; the pipeline has no credentials for this repository`,
      );
      expect(finding?.remediation).toMatch(/^Give the pipeline read access/);
    });

    it("describes a rejection that is not an Error by its string form", async () => {
      const { git, deps } = harness();
      git.fail("clone", URL, "connection reset");
      const result = await ingestSources(config([{ name: "docs", git: URL }]), deps);
      expect(result.findings.map((finding) => finding.message)).toEqual([
        'source "docs" could not be fetched: connection reset',
      ]);
    });

    it("does not stop ingestion: the following sources are still ingested in configuration order", async () => {
      const { git, deps } = harness({ [URL]: docs, "https://example.invalid/other.git": docs });
      git.fail("clone", "https://example.invalid/other.git", new Error("timeout"));
      const result = await ingestSources(
        config([
          { name: "first", git: URL },
          { name: "broken", git: "https://example.invalid/other.git" },
          { name: "last", git: URL },
        ]),
        deps,
      );
      expect(result.sources.map((source) => source.name)).toEqual(["first", "last"]);
      expect(result.findings.map((finding) => finding.source)).toEqual(["broken"]);
    });

    it("sorts findings canonically rather than in configuration order", async () => {
      const { deps } = harness({});
      const result = await ingestSources(
        config([
          { name: "zeta", git: URL },
          { name: "alpha", path: "./missing" },
        ]),
        deps,
      );
      expect(result.findings.map((finding) => finding.source)).toEqual(["alpha", "zeta"]);
    });
  });

  describe("local sources", () => {
    it("accepts a path source with the file system date in place of the commit", async () => {
      const { fs, deps } = harness();
      fs.writeText("/project/notes/b.md", "b");
      fs.writeText("/project/notes/a.md", "a");
      fs.dates.set("/project/notes/a.md", "2024-01-01T00:00:00.000Z");
      const result = await ingestSources(config([{ name: "notes", path: "./notes" }]), deps);
      expect(result).toEqual({
        findings: [],
        sources: [
          {
            name: "notes",
            locale: "en",
            root: "/project/notes",
            files: [
              {
                path: "a.md",
                absolutePath: "/project/notes/a.md",
                modifiedAt: "2024-01-01T00:00:00.000Z",
              },
              {
                path: "b.md",
                absolutePath: "/project/notes/b.md",
                modifiedAt: "1970-01-01T00:00:00.000Z",
              },
            ],
          },
        ],
      });
    });

    it("resolves the path relative to the configuration directory", async () => {
      const { fs, deps } = harness();
      fs.writeText("/shared/notes/a.md", "a");
      const result = await ingestSources(
        config([{ name: "notes", path: "../shared/notes" }]),
        deps,
      );
      expect(result.sources.map((source) => source.root)).toEqual(["/shared/notes"]);
    });

    it("yields a finding for a path that does not exist and no files for that source", async () => {
      const { deps } = harness();
      const result = await ingestSources(config([{ name: "notes", path: "notes" }]), deps);
      expect(result).toEqual({
        sources: [],
        findings: [
          unreachable("notes", 'source "notes" could not be read: /project/notes does not exist'),
        ],
      });
    });
  });

  describe("privacy exclusions", () => {
    it("leaves excluded files out of the result and never stamps them", async () => {
      const { fs, deps } = harness();
      fs.writeText("/project/notes/public.md", "ok");
      fs.writeText("/project/notes/private/secret.md", "no");
      const modifiedAt = vi.spyOn(fs, "modifiedAt");
      const result = await ingestSources(
        config(
          [
            { name: "docs", git: URL },
            { name: "notes", path: "notes" },
          ],
          { privacy: { exclude: ["private/**", "guide/*.md"] } },
        ),
        deps,
      );
      expect(result.sources.map((source) => source.files.map((file) => file.path))).toEqual([
        ["README.md"],
        ["public.md"],
      ]);
      expect(modifiedAt.mock.calls).toEqual([["/project/notes/public.md"]]);
    });

    it("never reads the content of any file: ingestion lists and stamps only", async () => {
      const { fs, deps } = harness();
      fs.writeText("/project/notes/a.md", "a");
      const readText = vi.spyOn(fs, "readText");
      await ingestSources(
        config([
          { name: "docs", git: URL },
          { name: "notes", path: "notes" },
        ]),
        deps,
      );
      expect(readText).not.toHaveBeenCalled();
    });
  });

  describe("locale", () => {
    it("takes the source locale, then the project locale, then en", async () => {
      const { fs, deps } = harness();
      fs.writeText("/project/a/x.md", "");
      fs.writeText("/project/b/x.md", "");
      const withProject = await ingestSources(
        config(
          [
            { name: "a", path: "a", locale: "en" },
            { name: "b", path: "b" },
          ],
          { project: { name: "Wiki", locale: "fr" } },
        ),
        deps,
      );
      expect(withProject.sources.map((source) => source.locale)).toEqual(["en", "fr"]);
      const withoutProject = await ingestSources(config([{ name: "b", path: "b" }]), deps);
      expect(withoutProject.sources.map((source) => source.locale)).toEqual(["en"]);
    });
  });

  describe("skipped sources", () => {
    it("skips tracker sources silently", async () => {
      const { git, deps } = harness();
      const result = await ingestSources(
        config([{ name: "issues", kind: "tracker", provider: "generic", project: "X" }]),
        deps,
      );
      expect(result).toEqual({ sources: [], findings: [] });
      expect(git.calls).toEqual([]);
    });

    it("skips a source that declares neither git nor path", async () => {
      const { git, deps } = harness();
      const result = await ingestSources(config([{ name: "empty" }]), deps);
      expect(result).toEqual({ sources: [], findings: [] });
      expect(git.calls).toEqual([]);
    });
  });
});
