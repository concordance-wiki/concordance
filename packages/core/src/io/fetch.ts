/** How long one network request may take before the build gives up on it. */
export const FETCH_TIMEOUT_MS = 30_000;
/** How many bytes a response may carry before the build gives up on it. */
export const FETCH_MAX_BYTES = 50 * 1024 * 1024;

export interface BoundedFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

/** The reason a request failed, worded for a finding: a timeout says so, anything else says what it said. */
export function fetchFailure(error: unknown, timeoutMs: number = FETCH_TIMEOUT_MS): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return `no response within ${String(Math.round(timeoutMs / 1000))} s`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetches within a time bound: a server that accepts the connection and never answers
 * fails after `timeoutMs` instead of holding the build, the hook or the pipeline for ever.
 */
export function fetchWithin(
  fetchImpl: typeof fetch,
  url: string,
  options: BoundedFetchOptions = {},
): Promise<Response> {
  return fetchImpl(url, {
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
  });
}

/**
 * The text of a response, read within a size bound: a declared length above the bound is
 * refused before a byte is read, and a body that grows past it is abandoned where it stands,
 * so that a response of gigabytes never fills the memory of the build.
 */
export async function readBounded(
  response: Response,
  maxBytes: number = FETCH_MAX_BYTES,
): Promise<string> {
  const tooLarge = new Error(`the response exceeds ${megabytes(maxBytes)} MB`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge;
  if (response.body === null) return "";
  // The body of a response is a stream of bytes, whatever the platform types it as.
  const body: ReadableStream<Uint8Array> = response.body;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let read = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    read += chunk.value.byteLength;
    if (read > maxBytes) {
      await reader.cancel();
      throw tooLarge;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}
