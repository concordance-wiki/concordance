import type { IslandBundle } from "./islands/bundle.js";
import { byCodeUnit } from "./order.js";

export interface PageSize {
  /** Path of the page under the output folder. */
  path: string;
  bytes: number;
}

export interface BudgetOptions {
  /** Excluding previews, per page. */
  maxPageBytes: number;
}

export interface BudgetReport {
  maxPageBytes: number;
  /** Every page, sorted by path. */
  pages: PageSize[];
  /** Pages above the budget, sorted by path. */
  overBudget: PageSize[];
  /** Every island bundle, sorted by name. */
  islands: IslandBundle[];
  /** Lines of the build summary. */
  summary: string[];
}

export function formatKilobytes(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

const byPath = (a: PageSize, b: PageSize): number => byCodeUnit(a.path, b.path);
const byName = (a: IslandBundle, b: IslandBundle): number => byCodeUnit(a.name, b.name);

/** Measures pages against the budget and describes the islands, for the build summary and CI. */
export function measureBudget(
  pages: PageSize[],
  islands: IslandBundle[],
  options: BudgetOptions,
): BudgetReport {
  const sortedPages = [...pages].sort(byPath);
  const sortedIslands = [...islands].sort(byName);
  const overBudget = sortedPages.filter((page) => page.bytes > options.maxPageBytes);
  const largest = sortedPages.reduce((max, page) => Math.max(max, page.bytes), 0);
  const summary = [
    ...sortedIslands.map((island) => `island ${island.name}: ${formatKilobytes(island.bytes)}`),
    `pages: ${String(sortedPages.length)}, largest ${formatKilobytes(largest)}, budget ${formatKilobytes(options.maxPageBytes)}`,
    ...overBudget.map((page) => `page ${page.path}: ${formatKilobytes(page.bytes)} over budget`),
  ];
  return {
    maxPageBytes: options.maxPageBytes,
    pages: sortedPages,
    overBudget,
    islands: sortedIslands,
    summary,
  };
}
