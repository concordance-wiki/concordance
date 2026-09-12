import { describe, expect, it } from "vitest";

import { convertMany } from "../src/pool.js";

/** A converter whose completions are released by the test, in any order, while counting how many run at once. */
function controlledConverter() {
  const pending = new Map<number, () => void>();
  let running = 0;
  let peak = 0;
  const convert = (input: number): Promise<string> =>
    new Promise((resolve) => {
      running += 1;
      peak = Math.max(peak, running);
      pending.set(input, () => {
        running -= 1;
        resolve(`done ${String(input)}`);
      });
    });
  const release = async (input: number): Promise<void> => {
    pending.get(input)?.();
    pending.delete(input);
    // Lets the worker that was freed pick the next input before the test inspects the state.
    await Promise.resolve();
    await Promise.resolve();
  };
  return { convert, release, started: () => [...pending.keys()], peak: () => peak };
}

describe("convertMany", () => {
  it("runs at most `parallelism` conversions at once and returns results in input order regardless of completion order", async () => {
    const converter = controlledConverter();
    const results = convertMany([1, 2, 3, 4, 5], 2, converter.convert);
    expect(converter.started()).toEqual([1, 2]);
    await converter.release(2);
    expect(converter.started()).toEqual([1, 3]);
    await converter.release(3);
    await converter.release(1);
    expect(converter.started()).toEqual([4, 5]);
    await converter.release(5);
    await converter.release(4);
    expect(await results).toEqual(["done 1", "done 2", "done 3", "done 4", "done 5"]);
    expect(converter.peak()).toBe(2);
  });

  it("starts no more workers than there are inputs", async () => {
    const converter = controlledConverter();
    const results = convertMany([1, 2], 8, converter.convert);
    expect(converter.started()).toEqual([1, 2]);
    await converter.release(1);
    await converter.release(2);
    expect(await results).toEqual(["done 1", "done 2"]);
    expect(converter.peak()).toBe(2);
  });

  it("runs one conversion at a time when the parallelism is below one or fractional", async () => {
    const converter = controlledConverter();
    const results = convertMany([1, 2, 3], 0, converter.convert);
    expect(converter.started()).toEqual([1]);
    await converter.release(1);
    await converter.release(2);
    await converter.release(3);
    expect(await results).toEqual(["done 1", "done 2", "done 3"]);
    expect(converter.peak()).toBe(1);
    const fractional = controlledConverter();
    const later = convertMany([1, 2], 1.9, fractional.convert);
    expect(fractional.started()).toEqual([1]);
    await fractional.release(1);
    await fractional.release(2);
    expect(await later).toEqual(["done 1", "done 2"]);
  });

  it("resolves to an empty list without calling the converter when there is no input", async () => {
    let calls = 0;
    const results = await convertMany([], 4, () => {
      calls += 1;
      return Promise.resolve("never");
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});
