import { describe, expect, it } from "vitest";

import {
  apiPageWithoutContract,
  entityPageWithoutProperty,
  keywordPageWithoutTimecode,
  singleSourceHeader,
  singleSourceHome,
} from "../../src/gallery/fixtures/degraded.js";
import { corporateKeywordPage } from "../../src/gallery/fixtures/keyword-page.js";
import { withoutIslandScripts } from "../../src/gallery/no-script.js";

describe("The degraded cases derive from the corporate fixtures", () => {
  it("feeds the home page and its bar from one repository: one space, its changes, nothing folded, no alert", () => {
    expect(singleSourceHeader.spaces?.items.map((item) => item.label)).toEqual(["glossary"]);
    expect(singleSourceHome.spaces.map((space) => space.name)).toEqual(["glossary"]);
    expect(singleSourceHome.moreSpaces).toEqual([]);
    expect(singleSourceHome.recent.map((entry) => entry.space)).toEqual(["glossary"]);
    expect(singleSourceHome.alerts).toEqual([]);
  });

  it("strips the rule of every property, put forward or declared", () => {
    expect(entityPageWithoutProperty.highlights).toEqual([]);
    expect(entityPageWithoutProperty.attributes).toEqual([]);
    expect(entityPageWithoutProperty.otherAttributes).toEqual([]);
    expect(entityPageWithoutProperty.sections.length).toBeGreaterThan(0);
  });

  it("removes the timecodes of the transcript passages and mentions, the pages and lines of the other files kept", () => {
    const locations = (page: typeof corporateKeywordPage) =>
      page.passages.flatMap((group) =>
        [...group.passages, ...(group.folded?.passages ?? [])].map((passage) => passage.location),
      );
    expect(locations(corporateKeywordPage)).toContain("34:51");
    expect(locations(corporateKeywordPage)).toContain("p. 12");
    const stripped = locations(keywordPageWithoutTimecode);
    expect(stripped.some((location) => /^\d/.test(location ?? ""))).toBe(false);
    expect(stripped).toContain("p. 12");
    expect(stripped).toContain("line 9");
    expect(stripped.filter((location) => location === undefined).length).toBe(5);
    const mentions = keywordPageWithoutTimecode.mentions.mentions.map(
      (mention) => mention.location,
    );
    expect(mentions.some((location) => /^\d/.test(location ?? ""))).toBe(false);
    expect(mentions).toContain("p. 12");
    expect(keywordPageWithoutTimecode.passages.map((group) => group.folded !== undefined)).toEqual(
      corporateKeywordPage.passages.map((group) => group.folded !== undefined),
    );
  });

  it("takes the contract away from the API page and names its application without the tool", () => {
    expect(apiPageWithoutContract.contract).toBeUndefined();
    expect(apiPageWithoutContract.sections.length).toBeGreaterThan(0);
    expect(
      apiPageWithoutContract.attributes.find((attribute) => attribute.name === "application")
        ?.values,
    ).toEqual([{ text: "query-service" }]);
    expect(apiPageWithoutContract.attributes.length).toBeGreaterThan(5);
  });
});

describe("A state served without scripts loses those of its islands and nothing else", () => {
  it("removes the deferred classic scripts, the module scripts and their preloads", () => {
    const html =
      '<head><script>boot()</script><link rel="stylesheet" href="assets/site.css"/>' +
      '<link rel="modulepreload" href="assets/viewer-AAAAAAAA.js"/>' +
      '<script type="module" defer src="assets/viewer-AAAAAAAA.js"></script>' +
      '<script defer src="assets/toc-2579D573.js"></script></head>' +
      '<body><concordance-island data-island="toc"></concordance-island></body>';
    expect(withoutIslandScripts(html)).toBe(
      '<head><script>boot()</script><link rel="stylesheet" href="assets/site.css"/></head>' +
        '<body><concordance-island data-island="toc"></concordance-island></body>',
    );
  });
});
