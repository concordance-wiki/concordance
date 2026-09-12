/** Runs `convert` on every input, at most `parallelism` at a time; results follow the input order. */
export async function convertMany<Input, Output>(
  inputs: readonly Input[],
  parallelism: number,
  convert: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = new Array<Output>(inputs.length);
  // Workers share one iterator: each pulls the next index as soon as it is free.
  const queue = inputs.entries();
  const worker = async (): Promise<void> => {
    for (const [index, input] of queue) {
      results[index] = await convert(input);
    }
  };
  const workers = Math.max(1, Math.min(Math.floor(parallelism), inputs.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
