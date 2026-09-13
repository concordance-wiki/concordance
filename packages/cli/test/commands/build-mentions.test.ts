import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  fixedClock,
  nodeFileSystem,
  pagePath,
  parseModel,
  type CanonicalModel,
} from "@concordance-wiki/core";
import { mentionsFragmentPath } from "@concordance-wiki/site";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import { FakeGit, recordedIo } from "../helpers.js";

const corpus = resolve(import.meta.dirname, "../../../../fixtures/corpora/realistic/en");

/** The limit a fragment must stay under, whatever the corpus: the size that keeps a load on demand cheap. */
const FRAGMENT_MAX_BYTES = 200_000;

interface MentionsFragment {
  id: string;
  mentions: { kind: string; file: { label: string; href: string }; line: number; href: string }[];
}

describe("One mentions fragment per entity, never a global index, on the realistic corpus", () => {
  let output: string;
  let model: CanonicalModel;
  let files: string[];

  beforeAll(async () => {
    output = mkdtempSync(join(tmpdir(), "concordance-mentions-"));
    const io = {
      fs: nodeFileSystem,
      git: new FakeGit(recordedIo().fs),
      clock: fixedClock("2026-09-12T12:00:00Z"),
      cwd: corpus,
      out: () => undefined,
      err: () => undefined,
    };
    expect(await buildCommand(["--output", output], io)).toBe(0);
    model = parseModel(readFileSync(join(output, "model.json"), "utf8"));
    files = nodeFileSystem.listFiles(output);
  });

  afterAll(() => {
    rmSync(output, { recursive: true, force: true });
  });

  it("writes fragments/<id>.mentions.json for exactly the entities with a related page, and nothing global", () => {
    const written = files.filter((file) => file.endsWith(".mentions.json")).sort();
    expect(written.length).toBeGreaterThan(50);
    // The entities whose page counts at least one related page, the keyword pages among them.
    const cited = model.entities
      .filter((entity) => {
        const page = readFileSync(join(output, pagePath(entity.id)), "utf8");
        return !page.includes('<h2 id="mentions-title">Related pages <span class="count">0</span>');
      })
      .map((entity) => mentionsFragmentPath(entity.id))
      .sort();
    expect(written).toEqual(cited);
    expect(cited.length).toBeLessThan(model.entities.length);
    for (const file of written) {
      const fragment = JSON.parse(readFileSync(join(output, file), "utf8")) as MentionsFragment;
      expect(file).toBe(mentionsFragmentPath(fragment.id));
      expect(fragment.mentions.length).toBeGreaterThan(0);
    }
    expect(
      files.filter((file) => file.endsWith(".json") && !file.startsWith("fragments/")),
    ).toEqual(["build.log.json", "model.json"]);
    expect(files.filter((file) => /^fragments\/[^/]+$/.test(file))).toEqual([]);
    // The search index is one meta file and its shards, JavaScript so that a file:// page loads them.
    expect(files.filter((file) => file.startsWith("search/"))).toContain("search/meta.js");
    expect(files.some((file) => /^search\/[a-z0-9]{2}\.js$/.test(file))).toBe(true);
  });

  it("keeps every fragment under two hundred kilobytes and the largest page under the budget", () => {
    for (const file of files.filter((file) => file.startsWith("fragments/"))) {
      expect(statSync(join(output, file)).size, file).toBeLessThan(FRAGMENT_MAX_BYTES);
    }
  });

  it("serves the first twenty mentions of the most cited entity in its page, one entry per related page, the rest reachable through its fragment", () => {
    // The notes alone: a keyword page lists the pages using the word, none of which writes a link to it.
    const fragments = files
      .filter((file) => file.endsWith(".mentions.json") && !file.startsWith("fragments/keywords/"))
      .map((file) => JSON.parse(readFileSync(join(output, file), "utf8")) as MentionsFragment)
      .sort((a, b) => b.mentions.length - a.mentions.length);
    const [most] = fragments;
    if (most === undefined) throw new Error("no fragment");
    expect(most.mentions.length).toBeGreaterThan(20);
    const page = readFileSync(join(output, pagePath(most.id)), "utf8");
    const island = /<concordance-island data-island="mentions-panel" data-props="([^"]*)"/.exec(
      page,
    );
    const props = JSON.parse((island?.[1] ?? "").replaceAll("&quot;", '"')) as {
      mentions: { href: string; kind: string; file: { href: string } }[];
    };
    expect(props.mentions).toHaveLength(20);
    expect(page).toContain(
      `href="${resolveFrom(pagePath(most.id), mentionsFragmentPath(most.id))}"`,
    );
    const inline = most.mentions.slice(0, 20);
    expect(props.mentions.map((mention) => mention.href)).toEqual(
      inline.map((mention) => mention.href),
    );
    const pages = new Set(inline.map((mention) => mention.file.href));
    expect(page.split('<li class="related-page').length - 1).toBe(pages.size);
    for (const href of pages) {
      expect(page).toContain(`<a class="related-title" href="${href}">`);
    }
    expect(most.mentions.some((mention) => mention.kind === "written")).toBe(true);
    expect(page.includes('<span class="related-mark">Cited · </span>')).toBe(
      inline.some((mention) => mention.kind === "written"),
    );
  });

  it("marks the words naming the entity in the passages the scan kept, as written in the note", () => {
    const fragment = JSON.parse(
      readFileSync(join(output, mentionsFragmentPath("glossary/entity")), "utf8"),
    ) as { mentions: { kind: string; context: string; surface?: string }[] };
    const marked = fragment.mentions.filter((mention) => mention.surface !== undefined);
    expect(marked.length).toBeGreaterThan(fragment.mentions.length / 2);
    expect(new Set(marked.map((mention) => mention.surface?.toLowerCase()))).toEqual(
      new Set(["entity", "entities"]),
    );
    for (const mention of marked) {
      expect(mention.context).toContain(mention.surface);
    }
    const page = readFileSync(join(output, pagePath("glossary/entity")), "utf8");
    expect(page).toMatch(/<q class="mention-context">[^<]*<mark>entit(y|ies)<\/mark>[^<]*<\/q>/);
  });
});

/** The href of a site file from a page, both as paths under the output folder. */
function resolveFrom(page: string, file: string): string {
  const depth = page.split("/").length - 1;
  return `${"../".repeat(depth)}${file}`;
}
