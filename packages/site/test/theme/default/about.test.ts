import { describe, expect, it } from "vitest";

import { aboutWithSections, corporateAbout } from "../../../src/gallery/fixtures/about.js";
import { renderSlot } from "../../../src/render.js";
import { defaultAboutLabels } from "../../../src/theme/default/about.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("About", () => {
  it("opens on the breadcrumb from the home page, the title, the sentence saying the site is rebuilt and the three figures", () => {
    const html = renderSlot("About", corporateAbout, defaultTheme);
    expect(html).toContain(
      '<div class="about"><nav class="breadcrumbs" aria-label="You are here"><ol class="breadcrumbs-list"><li><a href="../">Home</a></li><li><span aria-current="page">About this wiki</span></li></ol></nav><h1>About this wiki</h1><p class="about-lead">This site is rebuilt at every change of the repositories. It is not edited here: every correction is made in the original file, and appears at the next publication.</p>',
    );
    expect(html).toContain(
      '<dl class="about-figures"><div class="about-figure"><dt>Published on</dt><dd>Sep 13, 2026 10:04 AM</dd></div><div class="about-figure"><dt>Pages</dt><dd>134</dd></div><div class="about-figure"><dt>Indexed words</dt><dd>312</dd></div></dl>',
    );
    expect(count(html, "<h1")).toBe(1);
    expect(html).not.toContain("<details");
    expectBalanced(html);
  });

  it("lists the sources in one table with the five columns, each row naming the repository, its nature, the commit read, what was kept and its newest change", () => {
    const html = renderSlot("About", corporateAbout, defaultTheme);
    expect(html).toContain(
      '<section class="about-sources" aria-labelledby="about-sources"><h2 id="about-sources">Sources <span class="about-sources-lead">each with the version exactly used</span></h2><table class="about-table"><thead><tr><th scope="col" class="about-repository">Repository</th><th scope="col" class="about-nature">Nature</th><th scope="col" class="about-version">Version</th><th scope="col" class="about-content">Content kept</th><th scope="col" class="about-date">Last change</th></tr></thead><tbody>',
    );
    expect(html).toContain(
      '<tr class="about-row"><th scope="row" class="about-repository">glossary</th><td class="about-nature">Glossary</td><td class="about-version">a1f3c9e</td><td class="about-content">48 pages</td><td class="about-date"><time datetime="2026-09-11">2 days ago</time></td></tr>',
    );
    expect(count(html, '<tr class="about-row')).toBe(7);
  });

  it("marks a dormant source by its class, its date in days and a hidden phrase, and names it under the table with its threshold worded by the site", () => {
    const html = renderSlot("About", corporateAbout, defaultTheme);
    expect(html).toContain(
      '<tr class="about-row stale"><th scope="row" class="about-repository">framing</th><td class="about-nature">Framing</td><td class="about-version">e3c77a1</td><td class="about-content">4 documents</td><td class="about-date"><time datetime="2026-03-03">194 days ago</time><span class="visually-hidden">, past the freshness threshold</span></td></tr>',
    );
    expect(html).toContain(
      '<p class="about-note">The versions are those read at publication: two publications on the same versions produce an identical site. The source <b>framing</b> exceeds the freshness threshold of 180 days, which is reported here and in the build report, never on the pages themselves.</p>',
    );
  });

  it("closes on what the site does not contain, linking the report, how a page is corrected with the contribution address, and what is pseudonymised", () => {
    const html = renderSlot("About", corporateAbout, defaultTheme);
    expect(html).toContain(
      '<div class="about-closing"><p><b>What the site does not contain.</b> The files the configuration excludes, the documents whose conversion failed, and the words used fewer than 3 times. The <a href="../todo/">publication report</a> lists them.</p><p><b>Correct a page.</b> Every page carries at its foot the path of its file and a link to the forge. There is no other way to edit, and that is deliberate. <a href="https://forge.example/wiki/issues/new">How to contribute</a></p><p><b>What is pseudonymised.</b> The names of the participants are replaced at publication by stable pseudonyms. The mapping is never published.</p></div></div>',
    );
  });

  it("leaves out the contribution link and the pseudonymisation paragraph when the configuration says nothing, words the threshold of a dormant source itself without a sentence, and shows a source without a version or a date with empty cells", () => {
    const { contributeHref, ...rest } = corporateAbout;
    expect(contributeHref).toBeDefined();
    const html = renderSlot(
      "About",
      {
        ...rest,
        pseudonymised: false,
        threshold: 2,
        sources: [
          { name: "notes", nature: "", content: "0 pages", stale: false },
          {
            name: "old",
            nature: "Notes",
            content: "1 page",
            date: "2026-01-01",
            stale: true,
            threshold: 90,
          },
        ],
      },
      defaultTheme,
    );
    expect(html).not.toContain("How to contribute");
    expect(html).not.toContain("pseudonymised");
    expect(html).toContain("the words used fewer than 2 times.");
    expect(html).toContain(
      '<tr class="about-row"><th scope="row" class="about-repository">notes</th><td class="about-nature"></td><td class="about-version"></td><td class="about-content">0 pages</td><td class="about-date"></td></tr>',
    );
    expect(html).toContain(
      '<td class="about-date"><time datetime="2026-01-01">2026-01-01</time><span class="visually-hidden">, past the freshness threshold</span></td>',
    );
    expect(html).toContain(
      "The source <b>old</b> exceeds the freshness threshold of 90 days, which is reported here and in the build report, never on the pages themselves.</p>",
    );
    expect(defaultAboutLabels(2).notContainedText).toContain("fewer than 2 times.");
  });

  it("renders the sections of the file the configuration names after the generated content, on the template of a note", () => {
    const html = renderSlot("About", aboutWithSections, defaultTheme);
    expect(html).toContain(
      '</div><section id="section-who-maintains-this-wiki"><h2>Who maintains this wiki</h2><div class="markdown"><p>The maintainers of the tool, from the notes of its repositories; a correction is a change in one of them.</p></div></section></div>',
    );
    const lead = renderSlot(
      "About",
      { ...corporateAbout, sections: [{ id: "section-lead", html: "<p>A word.</p>" }] },
      defaultTheme,
    );
    expect(lead).toContain(
      '<section id="section-lead"><div class="markdown"><p>A word.</p></div></section>',
    );
    expectBalanced(html);
  });
});
