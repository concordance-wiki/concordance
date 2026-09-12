/** The error a reader throws: a plain error naming the file, carrying the original failure as its cause. */
export function readFailure(path: string, extension: string, cause: unknown): Error {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${path}: cannot read the ${extension} file: ${reason}`, { cause });
}
