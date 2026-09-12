import { describe, expect, it } from "vitest";

import { formatKilobytes, measureBudget } from "../src/budget.js";

describe("measureBudget", () => {
  const islands = [
    { name: "zeta", file: "zeta-A.js", bytes: 2_500 },
    { name: "mentions-panel", file: "mentions-panel-B.js", bytes: 11_960 },
  ];
  const pages = [
    { path: "todo/index.html", bytes: 20_000 },
    { path: "glossary/keyword-page/index.html", bytes: 151_000 },
    { path: "index.html", bytes: 150_000 },
  ];

  it("lists the pages over the budget, sorted by path, and keeps the budget in the report", () => {
    const report = measureBudget(pages, islands, { maxPageBytes: 150_000 });
    expect(report.maxPageBytes).toBe(150_000);
    expect(report.pages.map((page) => page.path)).toEqual([
      "glossary/keyword-page/index.html",
      "index.html",
      "todo/index.html",
    ]);
    expect(report.overBudget).toEqual([
      { path: "glossary/keyword-page/index.html", bytes: 151_000 },
    ]);
    expect(report.islands.map((island) => island.name)).toEqual(["mentions-panel", "zeta"]);
  });

  it("announces the size of each island and the pages over budget in the summary", () => {
    const report = measureBudget(pages, islands, { maxPageBytes: 150_000 });
    expect(report.summary).toEqual([
      "island mentions-panel: 12.0 kB",
      "island zeta: 2.5 kB",
      "pages: 3, largest 151.0 kB, budget 150.0 kB",
      "page glossary/keyword-page/index.html: 151.0 kB over budget",
    ]);
  });

  it("reports an empty site without any page over budget", () => {
    const report = measureBudget([], [], { maxPageBytes: 150_000 });
    expect(report.overBudget).toEqual([]);
    expect(report.summary).toEqual(["pages: 0, largest 0.0 kB, budget 150.0 kB"]);
  });

  it("keeps pages with the same path and islands with the same name next to each other", () => {
    const report = measureBudget(
      [
        { path: "a", bytes: 2 },
        { path: "a", bytes: 1 },
      ],
      [
        { name: "i", file: "i-1.js", bytes: 1 },
        { name: "i", file: "i-2.js", bytes: 2 },
      ],
      { maxPageBytes: 10 },
    );
    expect(report.pages.map((page) => page.bytes)).toEqual([2, 1]);
    expect(report.islands.map((island) => island.file)).toEqual(["i-1.js", "i-2.js"]);
  });

  it("does not mutate the lists it receives", () => {
    const copy = [...pages];
    measureBudget(pages, islands, { maxPageBytes: 1 });
    expect(pages).toEqual(copy);
  });
});

describe("formatKilobytes", () => {
  it("writes kilobytes of one thousand bytes with one decimal", () => {
    expect(formatKilobytes(0)).toBe("0.0 kB");
    expect(formatKilobytes(1_549)).toBe("1.5 kB");
    expect(formatKilobytes(150_000)).toBe("150.0 kB");
  });
});
