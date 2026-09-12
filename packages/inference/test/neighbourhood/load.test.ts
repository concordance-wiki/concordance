import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import { accumulateCooccurrences } from "../../src/neighbourhood/accumulate.js";
import type { OccurrenceLike } from "../../src/neighbourhood/types.js";
import { generator, paragraph } from "./fixtures.js";

const ENTITIES = 5_000;
const PARAGRAPHS = 20_000;
const PER_PARAGRAPH = 10;
/** Bytes the accumulation may add to the heap: rows bounded by 2K, never a 5,000 × 5,000 matrix. */
const MEMORY_THRESHOLD = 200 * 1024 * 1024;

// The flag exposes `gc` to contexts created afterwards; the heap is one per isolate, so a collection
// run in a fresh context clears the garbage of the test and leaves the retained neighbourhood alone.
setFlagsFromString("--expose-gc");
function collectGarbage(): void {
  runInNewContext("gc()");
}

function corpus(): OccurrenceLike[] {
  const next = generator(2_026);
  const occurrences: OccurrenceLike[] = [];
  for (let n = 0; n < PARAGRAPHS; n += 1) {
    const ids = Array.from(
      { length: PER_PARAGRAPH },
      () => `notes/entity-${String(Math.floor(ENTITIES * next())).padStart(4, "0")}`,
    );
    occurrences.push(...paragraph(`notes/note-${String(n >> 4)}.md`, (n % 16) * 3 + 1, ids));
  }
  return occurrences;
}

// Instrumented runs (coverage, mutation) are several times slower than the measured accumulation.
vi.setConfig({ testTimeout: 60_000 });

describe("the neighbourhood on a large corpus", () => {
  it("accumulates 5,000 entities over 20,000 paragraphs under 200 MB and ten seconds", () => {
    const occurrences = corpus();
    expect(occurrences).toHaveLength(PARAGRAPHS * PER_PARAGRAPH);

    collectGarbage();
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const neighbourhood = accumulateCooccurrences(occurrences, { k: 50 });
    const elapsed = performance.now() - started;
    collectGarbage();
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;

    process.stdout.write(
      `accumulated ${String(neighbourhood.nodes.size)} nodes in ${elapsed.toFixed(0)} ms, heap delta ${(heapDelta / 1024 / 1024).toFixed(1)} MB\n`,
    );
    expect(neighbourhood.nodes.size).toBe(ENTITIES);
    for (const neighbours of neighbourhood.nodes.values()) {
      expect(neighbours.length).toBeLessThanOrEqual(50);
    }
    expect(heapDelta).toBeLessThan(MEMORY_THRESHOLD);
    expect(elapsed).toBeLessThan(10_000);
  });
});
