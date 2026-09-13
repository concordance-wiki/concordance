import type { CategoryRow, SlotProps, SpaceTree } from "../../slots.js";
import { corporateHeader } from "./chrome.js";

/** The tree of the specifications space as its screens folder sees it: the folders at the top with their counts and their lists, this one marked. */
const corporateCategoryTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  href: "../",
  nodes: [
    { label: "api", count: 3, href: "../api/" },
    { label: "batches", count: 3, href: "../batches/" },
    { label: "endpoints", count: 6, href: "../endpoints/" },
    { label: "objects", count: 12, href: "../objects/" },
    { label: "processes", count: 5, href: "../processes/" },
    { label: "roles", count: 3, href: "../roles/" },
    { label: "rules", count: 10, href: "../rules/" },
    { label: "screens", count: 11, current: true },
    { label: "tables", count: 4, href: "../tables/" },
  ],
};

/** The bar of the category list: the field asks to search in the screens and submits with the space and the type selected. */
export const corporateCategoryHeader: SlotProps["Header"] = {
  ...corporateHeader,
  space: corporateCategoryTree,
  search: {
    action: "../search/",
    placeholder: "Search in screens",
    filters: { source: "specs", type: "screen" },
  },
};

function screenRow(
  slug: string,
  title: string,
  roles: string[],
  summary: string,
  links: number,
): CategoryRow {
  return {
    title,
    href: `${slug}/`,
    values: roles.map((role) => ({
      text: role,
      href: `../roles/${role.toLowerCase().replaceAll(" ", "-")}/`,
    })),
    keys: roles.map((role) => role.toLowerCase().replaceAll(" ", "-")),
    summary,
    links,
  };
}

/**
 * The screens of the specifications space of the fixtures corpus, by title, with the role of
 * each, its first line and its number of related pages; three roles, so that the sorts times the
 * values stay under the limit and every choice links to a pre-rendered variant.
 */
export const corporateCategoryList: SlotProps["CategoryList"] = {
  title: "Screens",
  space: corporateCategoryTree,
  breadcrumb: [
    { label: "Spaces", href: "../../spaces/" },
    { label: "specs", href: "../" },
    { label: "Screens" },
  ],
  lead: "11 screens described. A screen is a page of the application, with what it shows and what it allows.",
  unit: "Screen",
  filter: {
    label: "Roles",
    choices: [
      { label: "All", active: true },
      { label: "Author", key: "author", href: "-/roles-author/", active: false },
      { label: "Maintainer", key: "maintainer", href: "-/roles-maintainer/", active: false },
      {
        label: "Quality owner",
        key: "quality-owner",
        href: "-/roles-quality-owner/",
        active: false,
      },
    ],
  },
  sort: "title",
  sorts: [
    { label: "A–Z", key: "title", active: true },
    { label: "Links", key: "links", href: "-/links/", active: false },
  ],
  rows: [
    screenRow(
      "alphabetical-index",
      "Alphabetical index",
      ["Author"],
      "Lists every entity by title, letter by letter, with its type and its application.",
      3,
    ),
    screenRow(
      "service/document-viewer",
      "Document viewer",
      [],
      "Shows a converted document next to the note it twins with, through the Model query API.",
      5,
    ),
    screenRow(
      "entity-page",
      "Entity page",
      ["Author", "Maintainer"],
      "Shows an entity with its attributes, its links grouped by relation, its neighbourhood and the passages that mention it.",
      9,
    ),
    screenRow(
      "home-page",
      "Home page",
      ["Author"],
      "Shows the counts of entities per type, the date of the last build and the findings it raised.",
      4,
    ),
    screenRow(
      "keyword-page",
      "Keyword page",
      ["Maintainer"],
      "Lets a maintainer review a keyword page: the passages of an expression that crosses the publication threshold without a note.",
      12,
    ),
    screenRow(
      "mentions-panel",
      "Mentions panel",
      ["Author"],
      "Where the author sees every mention of an entity: the file, the line, the method that found it and the confidence it earned.",
      7,
    ),
    screenRow(
      "neighbourhood-map",
      "Neighbourhood map",
      ["Author", "Maintainer"],
      "Draws the neighbourhood of an entity: the strongest links first, in the order the profile gives for the type.",
      6,
    ),
    screenRow(
      "service/pinned-trail",
      "Pinned trail",
      [],
      "Keeps the entities a reader pinned from page to page, as decided in pinned trail in service.",
      4,
    ),
    screenRow(
      "search-results",
      "Search results",
      ["Author"],
      "Finds an entity or a keyword page by title, alias or identifier, from the search index.",
      8,
    ),
    screenRow(
      "service/suggestion-review",
      "Suggestion review",
      [],
      "Where a maintainer accepts or dismisses the suggestions the service drafts: a candidate to define, a link to promote, a stale note to revisit.",
      3,
    ),
    screenRow(
      "to-do-page",
      "To-do page",
      ["Quality owner"],
      "Lists the findings of the last build grouped by check and severity; the quality owner acknowledges a finding here and the author fixes it.",
      6,
    ),
  ],
  page: 1,
  pages: [{ number: 1 }],
  total: 11,
  labels: {
    spaceTree: "Tree of the space",
    breadcrumb: "You are here",
    sort: "Sort",
    sortTitle: "A–Z",
    sortLinks: "Links",
    all: "All",
    firstLine: "First line",
    links: "Links",
    pagination: "Pages of the list",
    shownOf: "{shown} screens of {total} — pagination by twenty.",
    note: "The Links column counts the related pages, which brings the most central screens of the journey to the top.",
  },
};
