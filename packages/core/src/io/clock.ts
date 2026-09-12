/** The only source of time in the tool, injected so that outputs stay deterministic under test. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const date = new Date(iso);
  return { now: () => date };
}

/** A clock frozen at `seconds` since the epoch, the unit of `SOURCE_DATE_EPOCH`. */
export function epochClock(seconds: number): Clock {
  const date = new Date(seconds * 1000);
  return { now: () => date };
}
