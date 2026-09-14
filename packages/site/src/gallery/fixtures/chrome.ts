import type { SlotProps } from "../../slots.js";
import { corporateSpaceTree } from "./corpus.js";

export const header: SlotProps["Header"] = {
  siteTitle: "My wiki",
  homeHref: "../",
  navigation: [
    { label: "Spaces", href: "../spaces/" },
    { label: "A–Z index", href: "../index/" },
    { label: "Recent", href: "../#home-recent" },
  ],
  search: { action: "../search/", placeholder: "Search the documentation" },
};

/** The header with a logo and without a search field, the other shape a project may configure. */
export const headerWithLogo: SlotProps["Header"] = {
  siteTitle: "My wiki",
  homeHref: "../",
  logo: {
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='7' fill='%23C24E24'/%3E%3C/svg%3E",
    alt: "",
  },
  navigation: [{ label: "Index", href: "../index/" }],
};

export const footer: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  repositories: { count: 2, href: "../spaces/", label: "2 repositories" },
  aboutHref: "../about/",
  profile: "default@1",
  pages: 105,
  links: [{ label: "Forge", href: "https://forge.example/wiki" }],
  todo: { label: "To do", href: "../todo/", count: 12 },
  credit: true,
};

/** The footer with a project text and no links, the tool left uncredited. */
export const footerWithText: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2024-05-01T10:00:00.000Z",
  repositories: { count: 2, href: "../spaces/", label: "2 repositories" },
  aboutHref: "../about/",
  profile: "default@1",
  pages: 105,
  text: "Documentation of the build pipeline, kept by its maintainers.",
  links: [],
  credit: false,
};

/** The mark of the tool, inlined so that the top bar of the corporate state carries a mark next to the name. */
export const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22"><rect x="7" y="11" width="27" height="6" rx="3" fill="currentColor"/><rect x="5" y="21" width="31" height="6" rx="3" fill="currentColor"/><rect x="11" y="31" width="26" height="6" rx="3" fill="currentColor"/><rect x="20" y="5" width="8" height="38" rx="4" fill="var(--color-accent)"/></svg>';

/** The top bar of the corporate state: the mark and the name, the search field, the spaces, the index and the recent changes; no statistic. */
export const corporateHeader: SlotProps["Header"] = {
  siteTitle: "Concordance documentation",
  homeHref: "../",
  logo: { svg: MARK_SVG },
  spaces: {
    label: "Spaces",
    href: "../spaces/",
    items: [
      { label: "glossary", href: "../glossary/", initials: "GL", count: 48 },
      { label: "specs", href: "../specs/", initials: "SP", count: 57 },
    ],
  },
  navigation: [
    { label: "A–Z index", href: "../index/" },
    { label: "Recent", href: "../#home-recent" },
  ],
  space: corporateSpaceTree,
  search: { action: "../search/", placeholder: "Search the documentation" },
};

/** The same bar with its drawer served open, as a phone shows it once the menu button is pressed. */
export const corporateDrawerHeader: SlotProps["Header"] = { ...corporateHeader, drawerOpen: true };

/**
 * The footer of the corporate state: what the tool knows of the fixtures corpus, worded as the
 * site words it, then what the organisation declared, the accessibility statement with its
 * state among the three legal pages; the to-do page with its count on the build line.
 */
export const corporateFooter: SlotProps["Footer"] = {
  version: "0.1.0",
  generatedAt: "2026-09-13T10:04:00.000Z",
  repositories: { count: 7, href: "../spaces/", label: "7 repositories" },
  aboutHref: "../about/",
  profile: "default@1",
  pages: 134,
  links: [
    { label: "Legal notice", href: "https://forge.example/legal/mentions" },
    {
      label: "Accessibility — partially compliant",
      href: "https://forge.example/legal/accessibility",
    },
    { label: "Personal data", href: "https://forge.example/legal/privacy" },
  ],
  todo: { label: "To do", href: "../todo/", count: 12 },
  credit: false,
  labels: {
    published: "Published on 13 September 2026 at 10:04, from",
    buildAt: "Sep 13, 2026 10:04 AM",
    profile: "profile default@1",
    pages: "134 pages",
  },
};

/** The footer of the corporate state without anything declared: the first column alone, exact and complete. */
export const corporateFooterAlone: SlotProps["Footer"] = { ...corporateFooter, links: [] };
