import type { Mention, SlotProps, SpaceTree } from "../../slots.js";
import { corporateEntityPage } from "./entity-page.js";

/** The sketch of the entity page the screen note embeds, inlined so that the gallery shows it without the copy the build places next to the page. */
const SKETCH_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 400' role='img' aria-label='Sketch of the entity page'%3E%3Crect width='720' height='400' fill='%23F7F6F3'/%3E%3Crect x='0' y='0' width='720' height='28' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='12' y='8' width='64' height='12' rx='3' fill='%231F2124'/%3E%3Crect x='96' y='6' width='200' height='16' rx='6' fill='%23F2F0EB'/%3E%3Crect x='0' y='28' width='128' height='372' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='10' y='40' width='14' height='14' rx='3' fill='%23F0EDE8'/%3E%3Crect x='30' y='43' width='60' height='8' rx='2' fill='%233A3E44'/%3E%3Crect x='10' y='68' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='18' y='84' width='72' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='14' y='98' width='3' height='12' fill='%23A8431C'/%3E%3Crect x='22' y='100' width='68' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='18' y='118' width='72' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='10' y='136' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='10' y='152' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='44' width='120' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='60' width='220' height='18' rx='3' fill='%231F2124'/%3E%3Crect x='148' y='86' width='40' height='10' rx='3' fill='%23F0EDE8'/%3E%3Crect x='196' y='88' width='110' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='148' y='110' width='360' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='124' width='340' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='138' width='300' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='162' width='120' height='10' rx='2' fill='%233A3E44'/%3E%3Crect x='148' y='184' width='360' height='96' rx='8' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='149' y='185' width='358' height='24' fill='%23FAF9F7'/%3E%3Crect x='160' y='194' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='300' y='194' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='400' y='194' width='80' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='160' y='222' width='90' height='6' rx='2' fill='%23A8431C'/%3E%3Crect x='300' y='222' width='50' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='400' y='222' width='90' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='160' y='250' width='70' height='6' rx='2' fill='%23A8431C'/%3E%3Crect x='300' y='250' width='50' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='400' y='250' width='70' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='148' y='300' width='360' height='72' rx='8' fill='%23FFFFFF' stroke='%23C9C4BB' stroke-dasharray='4 3'/%3E%3Crect x='548' y='28' width='172' height='372' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Crect x='560' y='44' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='60' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='74' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='88' width='148' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='118' width='60' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='134' width='2' height='12' fill='%23A8431C'/%3E%3Crect x='568' y='137' width='80' height='6' rx='2' fill='%233A3E44'/%3E%3Crect x='560' y='150' width='2' height='12' fill='%23E3E0DA'/%3E%3Crect x='568' y='153' width='90' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='184' width='70' height='6' rx='2' fill='%239AA0A8'/%3E%3Crect x='560' y='200' width='100' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='214' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='234' width='90' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='248' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='560' y='268' width='110' height='8' rx='2' fill='%231F2124'/%3E%3Crect x='560' y='282' width='140' height='6' rx='2' fill='%23C9C4BB'/%3E%3Crect x='548' y='360' width='172' height='40' fill='%23FFFFFF' stroke='%23E3E0DA'/%3E%3Ccircle cx='568' cy='380' r='4' fill='%23A8431C'/%3E%3Crect x='580' y='377' width='100' height='6' rx='2' fill='%233A3E44'/%3E%3C/svg%3E";

/** The tree of the specifications space as a screen sees it: the screens folder open on its neighbours, the current page marked. */
const screenSpaceTree: SpaceTree = {
  name: "specs",
  initials: "SP",
  href: "../../../#home-tree",
  nodes: [
    { label: "api", count: 3 },
    { label: "batches", count: 3 },
    { label: "endpoints", count: 6 },
    { label: "objects", count: 12 },
    { label: "processes", count: 5 },
    { label: "roles", count: 3 },
    { label: "rules", count: 10 },
    {
      label: "screens",
      count: 11,
      children: [
        { label: "Alphabetical index", href: "../alphabetical-index/" },
        { label: "Entity page", current: true },
        { label: "Home page", href: "../home-page/" },
        { label: "Keyword page", href: "../keyword-page/" },
        { label: "Mentions panel", href: "../mentions-panel/" },
        { label: "Neighbourhood map", href: "../neighbourhood-map/" },
        { label: "Search results", href: "../search-results/" },
        { label: "To-do page", href: "../to-do-page/" },
        { label: "service", count: 3 },
      ],
    },
    { label: "tables", count: 4 },
  ],
};

/** A page of the fixtures corpus that evokes the entity page screen. */
function screenMention(
  index: number,
  page: { id: string; title: string; type: string; typeLabel: string; path: string },
  context: string,
  kind: Mention["kind"] = "recognised",
): Mention {
  const href = `../../../${page.id}/`;
  return {
    kind,
    file: { label: page.path, href },
    title: page.title,
    type: page.type,
    typeLabel: page.typeLabel,
    context,
    line: index,
    href: `${href}#L${String(index)}`,
    surface: "entity page",
  };
}

const identifierRule = {
  id: "specs/rules/identifier-pattern",
  title: "Identifier pattern",
  type: "rule",
  typeLabel: "Business rule",
  path: "rules/identifier-pattern.rule.md",
};
const staleRule = {
  id: "specs/rules/stale-after-180-days",
  title: "Stale after 180 days",
  type: "rule",
  typeLabel: "Business rule",
  path: "rules/stale-after-180-days.rule.md",
};
const authorRole = {
  id: "specs/roles/author",
  title: "Author",
  type: "role",
  typeLabel: "Role",
  path: "roles/author.md",
};
const searchScreen = {
  id: "specs/screens/search-results",
  title: "Search results",
  type: "screen",
  typeLabel: "Screen",
  path: "screens/search-results.md",
};
const entityObject = {
  id: "specs/objects/entity",
  title: "Entity",
  type: "business_object",
  typeLabel: "Business object",
  path: "objects/entity.md",
};
const stalenessTerm = {
  id: "glossary/staleness",
  title: "Staleness",
  type: "term",
  typeLabel: "Term",
  path: "staleness.md",
};
const visionDocument = {
  id: "framing/vision",
  title: "Vision",
  type: "document",
  typeLabel: "Document",
  path: "vision.md",
};

/** The pages of the fixtures corpus that evoke the entity page screen: the ones that write a link, then the ones that merely name it. */
const screenMentions: Mention[] = [
  screenMention(
    7,
    staleRule,
    "The staleness report lists it and the entity page shows a badge.",
    "written",
  ),
  screenMention(12, staleRule, "Entity page", "written"),
  screenMention(11, identifierRule, "Entity page", "written"),
  screenMention(16, searchScreen, "Open an entity → entity page", "written"),
  screenMention(
    3,
    authorRole,
    "Reads entity page and mentions panel to see how a note is understood.",
    "written",
  ),
  screenMention(
    6,
    entityObject,
    "Filed into an application and a domain, connected by links, published as an entity page.",
  ),
  screenMention(
    12,
    entityObject,
    "The lifecycle ends when the entity page is written: discovered, typed, linked, published.",
  ),
  screenMention(
    6,
    stalenessTerm,
    "A stale note is reported by the staleness report and badged on its entity page.",
  ),
  screenMention(
    7,
    visionDocument,
    "Every note becomes an entity page, every recurring expression a keyword page, every doubt a finding.",
  ),
];

/** The page of the entity page screen of the fixtures corpus, the most consulted type, with its checks as a table and its original sketch in the flow of the note. */
export const corporateScreenPage: SlotProps["EntityPage"] = {
  entity: {
    id: "specs/screens/entity-page",
    type: "screen",
    typeLabel: "Screen",
    title: "Entity page",
    locale: "en",
  },
  space: screenSpaceTree,
  breadcrumb: [
    { label: "specs", href: "../../../#home-tree" },
    { label: "screens" },
    { label: "Entity page" },
  ],
  changed: { date: "2026-09-09", label: "Changed 4 days ago", short: "4 d ago" },
  highlights: [],
  sections: [
    {
      id: "section-lead",
      html: '<p>Shows an <a href="../../objects/entity/" class="recognised">entity</a> with its attributes, its <a href="../../objects/link/" class="recognised">links</a> grouped by relation, its <a href="../../objects/neighbourhood/" class="recognised">neighbourhood</a> and the passages that mention it. The staleness badge comes from the <a href="../../batches/staleness-report/" class="written">staleness report</a> batch; the <a href="../../../glossary/confidence/" class="recognised">confidence</a> of each link is displayed as the model wrote it.</p>',
    },
    {
      id: "section-objects",
      heading: "Objects",
      key: "objects",
      html: '<ul><li>Reads: <a href="../../objects/entity/" class="written">entity</a>, <a href="../../objects/link/" class="written">link</a>, <a href="../../objects/neighbourhood/" class="written">neighbourhood</a></li></ul>',
    },
    {
      id: "section-actions",
      heading: "Actions",
      key: "actions",
      html: '<ol><li>Open the mentions → <a href="../mentions-panel/" class="written">mentions panel</a></li><li>Open the map → <a href="../neighbourhood-map/" class="written">neighbourhood map</a></li><li>Back → <a href="../search-results/" class="written">search results</a></li></ol>',
    },
    {
      id: "section-rules",
      heading: "Rules",
      key: "rules",
      html: '<ul><li><a href="../../rules/identifier-pattern/" class="written">Identifier pattern</a></li><li><a href="../../rules/related-relation-cap/" class="written">Related relation cap</a></li></ul>',
    },
    {
      id: "section-checks-applied",
      heading: "Checks applied",
      html: '<table><thead><tr><th>Rule</th><th>Severity</th><th>Effect on validation</th></tr></thead><tbody><tr><td><a href="../../rules/identifier-pattern/" class="written">Identifier pattern</a></td><td>blocking</td><td>The build stops and the <a href="../../../glossary/finding/" class="recognised">finding</a> names the file</td></tr><tr><td><a href="../../rules/stale-after-180-days/" class="written">Stale after 180 days</a></td><td>warning</td><td>A badge on the page and a line in the <a href="../../batches/staleness-report/" class="recognised">staleness report</a></td></tr><tr><td><a href="../../rules/related-relation-cap/" class="written">Related relation cap</a></td><td>warning</td><td>The <a href="../../../glossary/confidence/" class="recognised">confidence</a> shown never exceeds 0.6</td></tr></tbody></table>',
    },
    {
      id: "section-original-sketch",
      heading: "Original sketch",
      html: `<figure class="figure"><img src="${SKETCH_SVG}" alt="Sketch of the entity page: the tree of the space, the note, the panel"><figcaption><span class="figure-caption">Sketch of the entity page: the tree of the space, the note, the panel</span><code class="figure-path">assets/entity-page-sketch.svg</code></figcaption></figure>`,
    },
  ],
  attributes: [
    { name: "domain", label: "Domain", values: [{ text: "Publication" }] },
    {
      name: "roles",
      label: "Roles",
      values: [
        { text: "Author", href: "../../roles/author/" },
        { text: "Maintainer", href: "../../roles/maintainer/" },
      ],
    },
    {
      name: "reads",
      label: "Reads",
      values: [
        { text: "Entity", href: "../../objects/entity/" },
        { text: "Link", href: "../../objects/link/" },
        { text: "Neighbourhood", href: "../../objects/neighbourhood/" },
      ],
    },
    { name: "url_pattern", label: "URL pattern", values: [{ text: "/entities/:id" }] },
  ],
  labels: {
    ...corporateEntityPage.labels,
    declaredAtTop: "4 declared keys. The rest of the file is free text.",
    neighbourPages: "6 pages",
  },
  neighbours: {
    centre: "Entity page",
    neighbours: [
      {
        id: "specs/objects/entity",
        label: "Entity",
        href: "../../objects/entity/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 5,
        rank: 0,
      },
      {
        id: "specs/objects/link",
        label: "Link",
        href: "../../objects/link/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 4,
        rank: 1,
      },
      {
        id: "specs/objects/neighbourhood",
        label: "Neighbourhood",
        href: "../../objects/neighbourhood/",
        typeLabel: "Business object",
        typeGlyph: "object",
        relation: "accesses",
        weight: 4,
        rank: 2,
      },
      {
        id: "specs/screens/mentions-panel",
        label: "Mentions panel",
        href: "../mentions-panel/",
        typeLabel: "Screen",
        typeGlyph: "screen",
        relation: "triggers",
        weight: 3,
        rank: 3,
      },
      {
        id: "specs/rules/identifier-pattern",
        label: "Identifier pattern",
        href: "../../rules/identifier-pattern/",
        typeLabel: "Business rule",
        typeGlyph: "rule",
        relation: "constrains",
        weight: 3,
        rank: 4,
      },
      {
        id: "specs/rules/stale-after-180-days",
        label: "Stale after 180 days",
        href: "../../rules/stale-after-180-days/",
        typeLabel: "Business rule",
        typeGlyph: "rule",
        relation: "constrains",
        weight: 2,
        rank: 5,
      },
    ],
    total: 6,
  },
  mentions: {
    mentions: screenMentions,
    initial: 20,
    pages: 7,
    labels: {
      ...corporateEntityPage.mentions.labels,
      orderNote:
        "Ordered by number of passages, written and recognised together. “Cited” marks a link present in the text.",
    },
    fragmentHref: "../../../fragments/specs/screens/entity-page.mentions.json",
  },
  sources: [{ source: "specs", path: "screens/entity-page.md" }],
};
