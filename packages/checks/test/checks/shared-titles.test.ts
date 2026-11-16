import { describe, expect, it } from "vitest";

import { SHARED_TITLE_REMEDIATION, sharedTitles } from "../../src/checks/shared-titles.js";
import type { CheckEntity } from "../../src/model.js";
import { entity, input } from "../fixtures.js";

function titled(id: string, title: string | undefined): CheckEntity {
  return { ...entity(id, "spec"), ...(title === undefined ? {} : { title }) };
}

describe("W-TITLE-SHARED", () => {
  it("reports a title three entities of one source share, once, on the first file in path order", () => {
    const findings = sharedTitles(
      input({
        entities: [
          titled("specs/invoice-export", "Purpose of the document"),
          titled("specs/billing-rules", "purpose of  the document "),
          titled("specs/customer-account", "Purpose of the document"),
          titled("specs/archive", "Archive"),
        ],
      }),
    );
    expect(findings).toEqual([
      {
        check: "W-TITLE-SHARED",
        severity: "warning",
        source: "specs",
        path: "billing-rules.md",
        entity: "specs/billing-rules",
        message:
          '"purpose of  the document " titles 3 entities of the source specs: billing-rules.md, customer-account.md, invoice-export.md',
        remediation: SHARED_TITLE_REMEDIATION,
      },
    ]);
  });

  it("names three paths and counts the rest", () => {
    const entities = ["a", "b", "c", "d", "e"].map((name) => titled(`specs/${name}`, "Template"));
    const [finding] = sharedTitles(input({ entities }));
    expect(finding?.message).toBe(
      '"Template" titles 5 entities of the source specs: a.md, b.md, c.md and 2 more',
    );
  });

  it("stays silent under three entities, across sources, and for entities without a title", () => {
    expect(
      sharedTitles(
        input({
          entities: [
            titled("specs/a", "Template"),
            titled("specs/b", "Template"),
            titled("notes/c", "Template"),
            titled("specs/d", undefined),
            titled("specs/e", undefined),
            titled("specs/f", "  "),
            titled("specs/g", "  "),
            titled("specs/h", "  "),
          ],
        }),
      ),
    ).toEqual([]);
  });
});
