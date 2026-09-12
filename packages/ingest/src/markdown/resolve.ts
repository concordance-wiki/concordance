import { posix } from "node:path";

import type { LinkContext, ResolvedLink } from "./types.js";

const scheme = /^[a-z][a-z0-9+.-]*:/i;

function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    // A stray percent sign is not an escape; the path is taken as written.
    return path;
  }
}

/** Folds `.` and `..`; a path that climbs above the root keeps its leading `..` and matches no file. */
function normalise(path: string): string {
  return posix.normalize(path).replace(/^\/+/, "");
}

export function resolveLink(target: string, context: LinkContext): ResolvedLink {
  if (scheme.test(target)) {
    return { kind: "external", url: target };
  }
  const hash = target.indexOf("#");
  const written = hash === -1 ? target : target.slice(0, hash);
  const anchor = hash === -1 ? {} : { anchor: target.slice(hash + 1) };
  const path = decode(written);
  if (path === "") {
    return { kind: "internal", path: context.path, ...anchor };
  }
  const fromFile = normalise(posix.join(posix.dirname(context.path), path));
  const fromRoot = normalise(path);
  for (const candidate of [fromFile, fromRoot]) {
    if (context.sourceFiles.has(candidate)) {
      return { kind: "internal", path: candidate, ...anchor };
    }
  }
  return { kind: "missing", path: fromFile, ...anchor };
}
