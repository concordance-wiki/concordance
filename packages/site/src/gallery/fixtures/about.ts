import type { AboutSource, SlotProps } from "../../slots.js";

/** A row of the sources table of the corporate state: the repository, what it holds, the commit read, what was kept and the newest change. */
function source(
  name: string,
  nature: string,
  version: string,
  content: string,
  date: string,
  dateLabel: string,
  threshold?: number,
): AboutSource {
  return {
    name,
    nature,
    version,
    content,
    date,
    dateLabel,
    stale: threshold !== undefined,
    ...(threshold === undefined
      ? {}
      : {
          threshold,
          staleNote: `exceeds the freshness threshold of ${String(threshold)} days, which is reported here and in the build report, never on the pages themselves.`,
        }),
  };
}

/**
 * The about page of the corporate state: the build of the fixtures corpus with its three
 * figures, its seven repositories with the version each was read at, the dormant one dated in
 * days and named under the table, and the contribution address of the configuration.
 */
export const corporateAbout: SlotProps["About"] = {
  homeHref: "../",
  generatedAt: "2026-09-13T10:04:00.000Z",
  figures: [
    { label: "Published on", value: "Sep 13, 2026 10:04 AM" },
    { label: "Pages", value: "134" },
    { label: "Indexed words", value: "312" },
  ],
  sources: [
    source("glossary", "Glossary", "a1f3c9e", "48 pages", "2026-09-11", "2 days ago"),
    source("specs", "Specifications", "7d20b44", "57 pages", "2026-09-09", "4 days ago"),
    source("meetings", "Meetings", "55ab8f0", "12 documents", "2026-09-12", "yesterday"),
    source("decisions", "Decisions", "b41d0ce", "8 pages", "2026-09-01", "12 days ago"),
    source("framing", "Framing", "e3c77a1", "4 documents", "2026-03-03", "194 days ago", 180),
    source("briefs", "Briefs", "9ff2a30", "3 documents", "2026-08-20", "3 weeks ago"),
    source("runbooks", "Runbooks", "c09e112", "2 pages", "2026-07-30", "last month"),
  ],
  threshold: 3,
  reportHref: "../todo/",
  contributeHref: "https://forge.example/wiki/issues/new",
  pseudonymised: true,
};

/** The about page of a project whose configuration names a markdown file: its sections follow the generated content. */
export const aboutWithSections: SlotProps["About"] = {
  ...corporateAbout,
  sections: [
    {
      id: "section-who-maintains-this-wiki",
      heading: "Who maintains this wiki",
      html: "<p>The maintainers of the tool, from the notes of its repositories; a correction is a change in one of them.</p>",
    },
  ],
};
