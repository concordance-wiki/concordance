import { describe, expect, it } from "vitest";

import { buildCommand } from "../src/commands/build.js";
import { stepMarker } from "../src/pipeline/run.js";
import { recordedIo, validConfig } from "./helpers.js";

describe("where the time of a build went", () => {
  it("tells the observer each step once it is over, in order, and nothing to no observer", () => {
    const seen: [string, number][] = [];
    const mark = stepMarker((step, milliseconds) => {
      seen.push([step, milliseconds]);
    });
    mark("first");
    mark("second");
    mark();
    mark();
    expect(seen.map(([step]) => step)).toEqual(["first", "second"]);
    expect(
      seen.every(([, milliseconds]) => Number.isInteger(milliseconds) && milliseconds >= 0),
    ).toBe(true);
    const silent = stepMarker(undefined);
    silent("first");
    silent();
  });

  it("prints the phases of the build and the steps of the pipeline after the summary on --timings, never without it", async () => {
    const io = recordedIo({
      "/work/concordance.yaml": validConfig,
      "/work/notes/a.md": "---\ntype: term\n---\n# A\n\nA note.\n",
    });
    expect(await buildCommand(["--timings"], io)).toBe(0);
    const start = io.stdout.indexOf("timings:");
    expect(start).toBeGreaterThan(0);
    const lines = io.stdout.slice(start + 1);
    expect(lines.map((line) => line.replace(/: \d+ ms$/u, ""))).toEqual([
      "  ingest sources",
      "  parse",
      "  read documents",
      "  load pseudonymisation",
      "  pseudonymise transcripts",
      "  type notes",
      "  scope privacy",
      "  index documents",
      "  import contracts",
      "  attach operations",
      "  stopwords",
      "  reconcile twins",
      "  build dictionaries",
      "  scan occurrences",
      "  produce links",
      "  combine links",
      "  refine relations",
      "  discover keywords",
      "  repoint links",
      "  propose domains",
      "  model checks",
      "  enrich findings",
      "  assemble result",
      "  pipeline",
      "  write log, model and fragments",
      "  render site",
    ]);
    expect(lines.every((line) => /: \d+ ms$/u.test(line))).toBe(true);
    expect(io.fs.readText("/work/dist/build.log.json")).not.toContain("timings");
    const plain = recordedIo({
      "/work/concordance.yaml": validConfig,
      "/work/notes/a.md": "---\ntype: term\n---\n# A\n\nA note.\n",
    });
    expect(await buildCommand([], plain)).toBe(0);
    expect(plain.stdout).not.toContain("timings:");
  });
});
