import type { ComponentChildren } from "preact";

/** The named parts of the site, in the order a theme author meets them: chrome first, then pages, then panels. */
export const SLOT_NAMES = [
  "Shell",
  "Header",
  "Footer",
  "Home",
  "EntityPage",
  "KeywordPage",
  "MentionsPanel",
  "Neighbourhood",
  "SearchResults",
  "Index",
  "Todo",
] as const;

export type SlotName = (typeof SLOT_NAMES)[number];

export function isSlotName(value: string): value is SlotName {
  return (SLOT_NAMES as readonly string[]).includes(value);
}

export interface Link {
  label: string;
  href: string;
}

export type TextDirection = "ltr" | "rtl";

/** What the document head loads: hrefs relative to the page. */
export interface HeadAssets {
  stylesheets: string[];
  modulePreloads: string[];
  scripts: string[];
}

export interface ShellProps {
  /** BCP 47 tag of the page, written on the `lang` attribute. */
  locale: string;
  direction: TextDirection;
  title: string;
  head: HeadAssets;
  children: ComponentChildren;
}

export interface SearchField {
  /** Page the query is submitted to, as a `GET` form with a `q` field. */
  action: string;
  placeholder: string;
}

export interface NavigationItem extends Link {
  /** A badge next to the label, the number of pending items of the to-do page for instance. */
  count?: number;
}

export interface HeaderProps {
  siteTitle: string;
  homeHref: string;
  logo?: { src: string; alt: string };
  navigation: NavigationItem[];
  search?: SearchField;
}

export interface FooterProps {
  /** Version of the tool that generated the site. */
  version: string;
  /** ISO 8601 instant of the build. */
  generatedAt: string;
  text?: string;
  links: Link[];
  /** Whether the discreet mention of the tool is shown. */
  mentionTool: boolean;
}

export interface HomeStats {
  sources: number;
  files: number;
  /** ISO 8601 instant of the build. */
  builtAt: string;
}

export interface HomeItem extends Link {
  count?: number;
  /** ISO 8601 date of the last change, for the freshness entry. */
  date?: string;
  /** Whether the source of the item is dormant according to the staleness thresholds. */
  stale?: boolean;
}

/** One of the three entry points of the home page: the file tree, the alphabetical index, the latest changes. */
export interface HomeEntry {
  kind: "tree" | "index" | "recent";
  title: string;
  href: string;
  items: HomeItem[];
}

export interface HomeProps {
  title: string;
  search?: SearchField;
  /** The most cited words, offered as shortcuts under the search field. */
  shortcuts: Link[];
  stats: HomeStats;
  entries: HomeEntry[];
}

export interface EntityRef {
  id: string;
  type: string;
  /** Label of the type in the locale of the page, shown as the badge. */
  typeLabel: string;
  title: string;
  locale: string;
}

export interface AttributeValue {
  text: string;
  href?: string;
}

export interface Attribute {
  name: string;
  label: string;
  values: AttributeValue[];
}

/** A section of the rendered note; `html` is the markdown already rendered and trusted. */
export interface Section {
  id: string;
  heading?: string;
  html: string;
}

export interface SourceRef {
  path: string;
  editHref?: string;
}

export interface EntityPageProps {
  entity: EntityRef;
  /** Qualifying properties shown next to the badge; the template shows at most five. */
  highlights: Attribute[];
  sections: Section[];
  /** Declared metadata of the side panel. */
  attributes: Attribute[];
  neighbours: NeighbourhoodProps;
  mentions: MentionsPanelProps;
  sources: SourceRef[];
}

export interface Passage {
  context: string;
  line: number;
  href: string;
}

export interface PassageGroup {
  file: Link;
  passages: Passage[];
}

export interface Companion {
  label: string;
  href?: string;
  /** Relative co-occurrence frequency, from 1 (rare) to 5 (frequent). */
  weight: number;
}

export interface KeywordPageProps {
  entity: { id: string; title: string; locale: string };
  counts: { occurrences: number; files: number; sources: number };
  /** Grouped by file, in corpus order. */
  passages: PassageGroup[];
  companions: Companion[];
  /** Expressions with a similar form, offered as a lead. */
  similar: Link[];
}

export interface Mention {
  /** A link written in a note, or a file that merely cites the entity. */
  kind: "written" | "recognised";
  file: Link;
  context: string;
  line: number;
  href: string;
}

export interface MentionsPanelProps {
  /** Written links first, then recognised mentions, each group in corpus order. */
  mentions: Mention[];
  /** How many mentions are in the served HTML; the rest is revealed on demand. */
  initial: number;
}

export interface Neighbour {
  id: string;
  label: string;
  href: string;
  typeLabel?: string;
  relation?: string;
  /** Co-occurrence count with the centre. */
  weight: number;
  /**
   * The priority group of the neighbour, as the model computed it from the profile; the panel
   * draws a separator where it changes and never decides the order itself.
   */
  rank?: number;
}

export interface NeighbourhoodProps {
  /** Title of the entity at the centre. */
  centre: string;
  /** In the order the model gives, which the panel keeps. */
  neighbours: Neighbour[];
}

export interface SearchResult {
  title: string;
  href: string;
  typeLabel?: string;
  snippet?: string;
}

export interface FacetValue {
  value: string;
  count: number;
  href: string;
}

export interface Facet {
  name: string;
  label: string;
  values: FacetValue[];
}

export interface SearchResultsProps {
  query: string;
  total: number;
  results: SearchResult[];
  facets: Facet[];
}

export interface IndexLetter {
  letter: string;
  /** Absent when the letter has no entry: it is shown inactive. */
  href?: string;
  count: number;
}

export interface IndexEntry extends Link {
  /** Glyph of the type; absent for a word without a note. */
  glyph?: string;
  count: number;
}

export interface IndexProps {
  letters: IndexLetter[];
  /** Letter of the segment shown. */
  current?: string;
  entries: IndexEntry[];
}

export interface TodoEntry extends Link {
  count: number;
}

export interface TodoProps {
  /** Documents without a markdown representation, with their file count. */
  documents: TodoEntry[];
  /** Words above the threshold without a note, with their occurrence count. */
  terms: TodoEntry[];
}

/** The view model of every slot, the contract between the site generator and a theme. */
export interface SlotProps {
  Shell: ShellProps;
  Header: HeaderProps;
  Footer: FooterProps;
  Home: HomeProps;
  EntityPage: EntityPageProps;
  KeywordPage: KeywordPageProps;
  MentionsPanel: MentionsPanelProps;
  Neighbourhood: NeighbourhoodProps;
  SearchResults: SearchResultsProps;
  Index: IndexProps;
  Todo: TodoProps;
}
