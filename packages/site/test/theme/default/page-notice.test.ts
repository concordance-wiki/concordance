import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { apiPageWithoutContract, corporateApiPage } from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import { PageNotice } from "../../../src/theme/default/page-notice.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { expectBalanced } from "../../helpers/html.js";

describe("The notice of a page whose datum is missing", () => {
  it("names the fact and what remains, draws the first exit filled and the others bordered, and unfolds the finding with the check after the cause", () => {
    const html = renderToString(
      h(PageNotice, {
        lead: "The contract of this interface could not be read.",
        detail: "The note stands on its own meanwhile.",
        exits: [
          { label: "Open the contract address", href: "https://forge.example/openapi.json" },
          { label: "Download the copy", href: "openapi.json", download: "openapi.json" },
        ],
        finding: { label: "Why this failure?", cause: "HTTP 404", check: "W-CONTRACT-UNREACHABLE" },
      }),
    );
    expect(html).toBe(
      '<aside class="page-notice" role="note"><p class="page-notice-lead">The contract of this interface could not be read.</p><p class="page-notice-detail">The note stands on its own meanwhile.</p><div class="page-notice-exits"><a class="button-primary" href="https://forge.example/openapi.json">Open the contract address</a><a class="button-secondary" href="openapi.json" download="openapi.json">Download the copy</a><details class="page-notice-why"><summary class="button-secondary">Why this failure?</summary><p>HTTP 404 <code>W-CONTRACT-UNREACHABLE</code></p></details></div></aside>',
    );
  });

  it("stands without a finding and without an exit, the paragraphs alone", () => {
    const html = renderToString(h(PageNotice, { lead: "Missing.", detail: "Remains.", exits: [] }));
    expect(html).toBe(
      '<aside class="page-notice" role="note"><p class="page-notice-lead">Missing.</p><p class="page-notice-detail">Remains.</p><div class="page-notice-exits"></div></aside>',
    );
  });

  it("is drawn under the header of an api whose contract could not be read, and nowhere on a page without one", () => {
    const html = renderSlot("EntityPage", apiPageWithoutContract, defaultTheme);
    expect(html).toContain(
      '</header><aside class="page-notice" role="note"><p class="page-notice-lead">The contract of this interface could not be read.</p>',
    );
    expect(html).toContain(
      '<a class="button-primary" href="https://forge.example/query-service/openapi.json">Open the contract address</a><details class="page-notice-why">',
    );
    expect(html).toContain("<code>W-CONTRACT-UNREACHABLE</code>");
    expect(html).not.toContain("api-operations");
    expectBalanced(html);
    expect(renderSlot("EntityPage", corporateApiPage, defaultTheme)).not.toContain("page-notice");
  });
});
