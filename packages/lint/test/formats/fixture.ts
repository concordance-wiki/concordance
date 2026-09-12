import { createRegistry } from "@concordance-wiki/checks";
import type { Finding } from "@concordance-wiki/core";

import type { FormatContext } from "../../src/formats/context.js";

export const DOCUMENTATION =
  "https://github.com/concordance-wiki/concordance/blob/main/docs/checks";

export const broken: Finding = {
  check: "E-LINK-BROKEN",
  severity: "error",
  source: "notes",
  path: "specs/entry.md",
  line: 3,
  message: 'link "gone.md" in specs/entry.md points to specs/gone.md, which does not exist',
  remediation: "Fix the path.",
};

/** No line: the whole file is at stake. */
export const duplicate: Finding = {
  check: "E-ID-DUP",
  severity: "warning",
  source: "notes",
  path: "dup/a.rule.md",
  entity: "notes/dup/a",
  message:
    "notes/dup/a.rule.md resolves to notes/dup/a, already taken by notes/dup/a.md, which is kept",
  remediation: "Rename one of the files.",
};

/** No path at all, and characters every format has to escape. */
export const unreachable: Finding = {
  check: "W-SOURCE-UNREACHABLE",
  severity: "info",
  message: 'source <notes> & "friends" could not be read',
  remediation: "Fix the path.",
};

/** Deliberately out of the canonical order: every format sorts. */
export const findings: readonly Finding[] = [unreachable, broken, duplicate];

export const context: FormatContext = {
  root: "/work",
  version: "1.2.3",
  registry: createRegistry(),
};
