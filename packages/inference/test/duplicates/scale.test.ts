import { describe, expect, it } from "vitest";

import { resolveDuplicateResources } from "../../src/duplicates/resolve.js";
import type { DuplicateResource } from "../../src/duplicates/types.js";
import { generator, normalize, options, perturb, randomText, resource } from "./fixtures.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function name(random: () => number): string {
  return Array.from({ length: 12 }, () => LETTERS[Math.floor(random() * 26)] ?? "a").join("");
}

describe("the reconciliation at scale", () => {
  it("finds 50 planted near-duplicates among 2,000 resources of 200 words in under 5 seconds", () => {
    const random = generator(2024);
    const resources: DuplicateResource[] = [];
    const planted: [string, string][] = [];
    for (let index = 0; index < 1950; index++) {
      const text = randomText(random, 200);
      const folder = `folder-${String(index % 40)}`;
      const original = resource({ path: `${folder}/${name(random)}.md`, text });
      resources.push(original);
      if (index < 50) {
        const twin = resource({
          path: `decks/${name(random)}.pdf`,
          text: perturb(text, random, 50),
        });
        resources.push(twin);
        planted.push([original.id, twin.id]);
      }
    }
    expect(resources).toHaveLength(2000);
    const started = performance.now();
    const result = resolveDuplicateResources({ resources, normalizeText: normalize }, options());
    const elapsed = performance.now() - started;
    const found = new Set(result.pairs.map((pair) => `${pair.a} ${pair.b}`));
    for (const [a, b] of planted) {
      expect(found.has(a < b ? `${a} ${b}` : `${b} ${a}`)).toBe(true);
    }
    expect(result.pairs).toHaveLength(50);
    expect(result.stats.candidatePairs).toBe(50);
    expect(elapsed).toBeLessThan(5000);
  });
});
