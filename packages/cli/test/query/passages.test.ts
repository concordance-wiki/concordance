import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import {
  comparable,
  excerptOf,
  findPassages,
  hasFragments,
  plainText,
} from "../../src/query/passages.js";
import { recordedIo, validConfig } from "../helpers.js";

describe("the passages a phrase is read in", () => {
  it("compares without accents, case or extra spaces, strips the tags of a section, and excerpts around the phrase", () => {
    expect(comparable("  Éclair  au\nCafé ")).toBe("eclair au cafe");
    expect(
      plainText("<p>a &amp; <b>b</b> &lt;c&gt; &quot;d&quot; &#39;e&#39;</p><p>f<br>g</p>"),
    ).toBe("a & b <c> \"d\" 'e' f g ");
    expect(excerptOf("the mint page", "mint")).toBe("the mint page");
    expect(excerptOf("nothing here", "mint")).toBeUndefined();
    const long = `${"a".repeat(100)} mint ${"b".repeat(100)}`;
    expect(excerptOf(long, "mint")).toBe(`…${"a".repeat(79)} mint ${"b".repeat(79)}…`);
  });

  it("reads the positions of the documents and the sections of the notes from the fragments, in corpus order, within a source when asked", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig,
      "/work/notes/a.md":
        "---\ntype: term\n---\n# Alpha\n\nThe mint rule.\n\n## Detail\n\nA second mint.\n",
      "/work/notes/b.md": "---\ntype: term\n---\n# Beta\n\nNo such phrase.\n",
    });
    await buildCommand([], io);
    expect(hasFragments(io, "/work/dist")).toBe(true);
    const model = JSON.parse(io.fs.readText("/work/dist/model.json")) as Parameters<
      typeof findPassages
    >[1];
    io.fs.writeText(
      "/work/dist/fragments/notes/b.json",
      JSON.stringify({
        id: "notes/b",
        sections: [],
        documents: [
          {
            source: "notes",
            path: "b.vtt",
            format: "vtt",
            target: "notes/b/b.vtt",
            unit: "cue",
            pages: [
              {
                number: 1,
                label: "00:00:04",
                speaker: "Participant-1",
                text: "A mint in the cue.",
              },
              { number: 2, label: "00:00:10", text: "Nothing." },
            ],
          },
          {
            source: "notes",
            path: "a.pdf",
            format: "pdf",
            target: "notes/b/a.pdf",
            unit: "page",
            pages: [{ number: 3, label: "page 3", text: "Mint on a slide." }],
          },
        ],
      }),
    );
    io.fs.writeText("/work/dist/fragments/notes/c.json", "{}");
    const passages = findPassages(io, model, "/work/dist", "MINT", undefined);
    expect(
      passages.map((passage) => [
        passage.entity,
        passage.path,
        "section" in passage ? passage.section : passage.position.label,
      ]),
    ).toEqual([
      ["notes/a", "a.md", "Alpha"],
      ["notes/a", "a.md", "Detail"],
      ["notes/b", "a.pdf", "page 3"],
      ["notes/b", "b.vtt", "00:00:04"],
    ]);
    expect(passages[3]).toMatchObject({
      position: { unit: "cue", speaker: "Participant-1", number: 1 },
      excerpt: "A mint in the cue.",
    });
    expect(passages[0]).toMatchObject({ section: "Alpha", excerpt: "The mint rule." });
    expect(findPassages(io, model, "/work/dist", "mint", "elsewhere")).toEqual([]);
    for (const name of io.fs.listFiles("/work/dist/fragments"))
      io.fs.remove(`/work/dist/fragments/${name}`);
    expect(hasFragments(io, "/work/dist")).toBe(false);
    expect(findPassages(io, model, "/work/dist", "mint", undefined)).toEqual([]);
  });
});
