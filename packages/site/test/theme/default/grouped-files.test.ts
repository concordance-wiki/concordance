import { describe, expect, it } from "vitest";

import {
  corporateApiPage,
  corporateDecisionPage,
  corporateEntityPage,
  entityPageWithTwin,
} from "../../../src/gallery/fixtures.js";
import { renderSlot } from "../../../src/render.js";
import type { EntityPageProps, GroupedFiles } from "../../../src/slots.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(props: EntityPageProps): string {
  return renderSlot("EntityPage", props, defaultTheme);
}

const grouping = entityPageWithTwin.grouping as GroupedFiles;

const block =
  '<div class="grouped-files"><p class="grouped-files-lead">2 files grouped — same base name</p><ul class="grouped-files-list"><li><code class="grouped-file-name">publication-threshold.rule.md</code><span class="grouped-file-format">Markdown note</span></li><li><code class="grouped-file-name">publication-threshold.rule.docx</code><span class="grouped-file-format">Text document</span></li></ul><a class="grouped-files-separate" href="https://forge.example/specs">Separate these files</a></div>';

describe("The grouped files stand at the foot of the properties block of every template, said the same way", () => {
  it("closes the properties of the generic page with the line, the files and the link, after the note counting the keys", () => {
    const html = render(entityPageWithTwin);
    expectBalanced(html);
    expect(html).toContain(
      `<p class="panel-note">4 declared keys. The rest of the file is free text.</p>${block}</details></section>`,
    );
    expect(count(html, 'class="grouped-files"')).toBe(1);
    expect(render(corporateEntityPage)).not.toContain("grouped-files");
  });

  it("draws the properties block for the grouped files alone when the note declares no key, without a count or the note on the keys", () => {
    const html = render({ ...corporateEntityPage, attributes: [], grouping });
    expect(html).toContain(
      `<summary><h2 id="entity-properties">Properties</h2></summary>${block}</details></section>`,
    );
    expect(html).not.toContain("declared key");
    expect(render({ ...corporateEntityPage, attributes: [] })).not.toContain(
      'id="entity-properties"',
    );
  });

  it("closes the five keys of the API page with the block, and draws the block alone without any key", () => {
    const html = render({ ...corporateApiPage, grouping });
    expectBalanced(html);
    expect(html).toContain(
      `<p class="panel-note">Five keys, no more. The operations come from the contract, not from the header.</p>${block}</details></section>`,
    );
    const alone = render({ ...corporateApiPage, highlights: [], attributes: [], grouping });
    expect(alone).toContain(
      `<summary><h2 id="entity-properties">Properties</h2></summary>${block}</details></section>`,
    );
    expect(alone).not.toContain("Five keys");
    expect(render(corporateApiPage)).not.toContain("grouped-files");
  });

  it("closes the properties of the decision page with the block, after the note counting the keys", () => {
    const html = render({ ...corporateDecisionPage, grouping });
    expectBalanced(html);
    expect(html).toContain(
      `<p class="panel-note">4 keys: the status and the date are authoritative.</p>${block}</details></section>`,
    );
    expect(render(corporateDecisionPage)).not.toContain("grouped-files");
  });
});
