import { epochClock, systemClock, type Clock } from "@concordance-wiki/core";

/**
 * The reproducible-builds convention: `SOURCE_DATE_EPOCH`, in seconds since the epoch, pins the
 * only timestamp of the outputs. Anything else than a non-negative integer leaves the system clock.
 */
export function clockFromEnvironment(env: NodeJS.ProcessEnv): Clock {
  const value = env["SOURCE_DATE_EPOCH"];
  if (value !== undefined && /^\d+$/.test(value)) {
    return epochClock(Number(value));
  }
  return systemClock;
}
