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

/**
 * The parts of an entity page a theme or a type module may render for one attribute or one
 * mapped section: `Attribute@<name>` receives the value of that attribute, `Section@<key>` the
 * section of the note the profile maps under that key.
 */
export const PART_NAMES = ["Attribute", "Section"] as const;

export type PartName = (typeof PART_NAMES)[number];

/** What a `components` key of a theme or a `components/` file of a type module names. */
export type ComponentName =
  | { kind: "slot"; slot: SlotName }
  | { kind: "page"; type: string }
  | { kind: "attribute"; name: string }
  | { kind: "section"; key: string };

const TYPED_NAME = /^([A-Za-z]+)@([a-z][a-z0-9_]*)$/;

/**
 * Reads a component name: a slot (`Footer`), the page of one type (`EntityPage@runbook`), the
 * value of one attribute (`Attribute@steps`) or one mapped section (`Section@steps`); undefined
 * for any other name.
 */
export function parseComponentName(name: string): ComponentName | undefined {
  if (isSlotName(name)) {
    return { kind: "slot", slot: name };
  }
  const match = TYPED_NAME.exec(name);
  const [, base, key] = match ?? [];
  if (base === undefined || key === undefined) {
    return undefined;
  }
  switch (base) {
    case "EntityPage":
      return { kind: "page", type: key };
    case "Attribute":
      return { kind: "attribute", name: key };
    case "Section":
      return { kind: "section", key };
    default:
      return undefined;
  }
}

export interface Link {
  label: string;
  href: string;
}

export type TextDirection = "ltr" | "rtl";

/** What the document head loads: hrefs relative to the page. */
export interface HeadAssets {
  /** Inline scripts written before the stylesheets; the renderer emits one, which applies the remembered colour scheme. */
  inlineScripts?: string[];
  stylesheets: string[];
  modulePreloads: string[];
  /** Module scripts, deferred by nature. */
  scripts: string[];
  /** Classic scripts, written with `defer`: the islands that must run from a `file://` page in every browser. */
  classicScripts?: string[];
  /** Href of the favicon; `type` is inferred from the extension. */
  favicon?: string;
  /** Href the page forwards to at once, as a `<meta http-equiv="refresh">`; the body repeats it as a link. */
  redirect?: string;
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
  /** Accessible name of the field; the theme's own label when absent. */
  label?: string;
  /**
   * Href of the root of the site from the page, `../` for instance, where `search/` holds the
   * index; absent when the site has no index, and the field then only submits.
   */
  root?: string;
}

export interface NavigationItem extends Link {
  /** A badge next to the label, the number of pending items of the to-do page for instance. */
  count?: number;
}

/** The logo of the header: an image by href, or the markup of an SVG inlined so that it can follow the current colour. */
export type HeaderLogo = { src: string; alt: string } | { svg: string };

export interface TrailLabels {
  /** Accessible name of the trail region. */
  title: string;
  pin: string;
  unpin: string;
  /** Shown when the trail holds no page. */
  empty: string;
  /** Follows the number of condensed entries: "… 5 earlier pages". */
  earlier: string;
}

export interface TrailPage {
  id: string;
  title: string;
}

/** The navigation trail under the header: the pages the reader visited, carried in the URL fragment. */
export interface TrailProps {
  /** Prefix of the hrefs from the page to the site root, `../../` for instance; empty at the root. */
  base: string;
  /** The entity of the page, appended to the trail; absent on the home, index and to-do pages, which carry the trail without entering it. */
  current?: TrailPage;
  labels: TrailLabels;
}

export interface HeaderProps {
  siteTitle: string;
  homeHref: string;
  logo?: HeaderLogo;
  navigation: NavigationItem[];
  search?: SearchField;
  /** Absent, the default theme renders the trail with its own English labels and records no page. */
  trail?: TrailProps;
}

export interface FooterProps {
  /** Version of the tool that generated the site. */
  version: string;
  /** ISO 8601 instant of the build. */
  generatedAt: string;
  text?: string;
  links: Link[];
  /** Whether the discreet credit of the tool, a link to its repository, is shown; nothing else names it. */
  credit: boolean;
}

export interface HomeStats {
  sources: number;
  files: number;
  /** ISO 8601 instant of the build. */
  builtAt: string;
  /** The day of the build in the words of the project locale; the theme shows the instant when absent. */
  builtAtLabel?: string;
}

export interface HomeItem extends Link {
  count?: number;
  /** ISO 8601 date of the last change, for the freshness entry. */
  date?: string;
  /** The date in the words of the project locale; the theme shows `date` when absent. */
  dateLabel?: string;
  /** Whether the source of the item is dormant according to the staleness thresholds. */
  stale?: boolean;
}

/** A node of the file tree: a source, a folder or a note; only a note has a page. */
export interface HomeTreeNode {
  label: string;
  href?: string;
  /** How many notes a source or a folder holds. */
  count?: number;
  children?: HomeTreeNode[];
}

/** A source of the freshness entry: its newest change, and whether the staleness threshold makes it dormant. */
export interface HomeSource {
  name: string;
  /** ISO 8601 date of the newest change among its notes; absent when none carries a git date. */
  date?: string;
  dateLabel?: string;
  stale: boolean;
}

/** One of the three entry points of the home page: the file tree, the alphabetical index, the latest changes. */
export interface HomeEntry {
  kind: "tree" | "index" | "recent";
  title: string;
  /** Where the whole of the entry lives, when it has a page of its own. */
  href?: string;
  items: HomeItem[];
  /** The sources, their folders and their notes, for the `tree` entry. */
  tree?: HomeTreeNode[];
  /** Every source with its newest change, for the `recent` entry. */
  sources?: HomeSource[];
}

export interface HomeProps {
  title: string;
  search?: SearchField;
  /** The most cited words, offered as shortcuts under the search field. */
  shortcuts: Link[];
  stats: HomeStats;
  entries: HomeEntry[];
  /** The link to the to-do page with the number of its entries. */
  todo?: NavigationItem;
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
  /** The label the profile gives the attribute in the language of the page, else its name. */
  label: string;
  values: AttributeValue[];
}

/** A section of the rendered note; `html` is the markdown already rendered and trusted. */
export interface Section {
  id: string;
  heading?: string;
  html: string;
  /** The mapped section of the type whose heading the section carries, `steps` for instance; absent for an ordinary section. */
  key?: string;
}

/** An attribute of the type as the profile declares it, labelled in the language of the page. */
export interface DeclaredAttribute {
  name: string;
  label: string;
  /** The kind of value: `string`, `ref[]`, `list`... as the profile writes it. */
  type: string;
  /** The type slugs a reference may point at, as declared (`any` and `same` included). */
  target?: string[];
  /** The relation a reference produces. */
  relation?: string;
  /** The allowed values of an enum. */
  values?: string[];
}

/** A mapped section of the type: its key, its heading in the language of the page and the relation it produces. */
export interface DeclaredSection {
  key: string;
  heading: string;
  parse: string;
  produces: string;
}

/** The declaration of the type of the page, as the profile has it, so that a dedicated component can lay the page out from it. */
export interface TypeDeclaration {
  type: string;
  label: string;
  group: string;
  glyph?: string;
  /** The attributes of the type in declaration order, the common attributes left out. */
  attributes: DeclaredAttribute[];
  /** The mapped sections in declaration order. */
  sections: DeclaredSection[];
  display: {
    highlight: string[];
    neighboursOrder: string[];
  };
}

/** The headings the generic page adds itself, in the language of the site; the theme's own English when absent. */
export interface EntityPageLabels {
  /** Heading of the panel of declared attributes. */
  properties: string;
  /** Heading of the section listing the attributes the type does not declare. */
  otherAttributes: string;
}

/** The value of one attribute of an entity page, what an `Attribute@<name>` component receives. */
export interface AttributeProps {
  entity: EntityRef;
  attribute: Attribute;
}

/** One mapped section of an entity page, what a `Section@<key>` component receives. */
export interface SectionProps {
  entity: EntityRef;
  section: Section;
}

export interface SourceRef {
  /** Name of the declared source the file belongs to. */
  source: string;
  /** Forward-slash path relative to the source root. */
  path: string;
  /** Where the file is edited on its forge; absent for a local source without a known forge. */
  editHref?: string;
}

/** One file of a document, offered for download. */
export interface DocumentFile {
  /** The file name, what the link says. */
  label: string;
  /** Href relative to the page. */
  href: string;
  /** Lowercase extension without its dot. */
  format: string;
}

/** The PDF of a document and the scripts that leaf through it, all hrefs relative to the page. */
export interface DocumentPreview {
  /** The PDF itself, a link without JavaScript and what the viewer opens. */
  href: string;
  /** The viewer bundle, imported on demand when the reader asks for it; never loaded with the page. */
  viewerHref?: string;
  /** The worker of the viewer, loaded by the viewer bundle. */
  workerHref?: string;
}

/** One position of a document with its extracted text: a page, a slide or a cue. */
export interface DocumentPosition {
  number: number;
  /** `page 3`, `slide 3`, or a timecode. */
  label: string;
  text: string;
}

/** A document of the entity that is not its note: what the page offers, with or without JavaScript. */
export interface DocumentView {
  file: DocumentFile;
  preview?: DocumentPreview;
  /** How the positions are named: the pages of a PDF, the slides of a deck, the cues of a transcript. */
  unit: "page" | "slide" | "cue";
  positions: DocumentPosition[];
}

/** One operation of an imported contract, as the static list of the API page names it. */
export interface ContractOperationItem {
  /** The operation name as the contract writes it. */
  name: string;
  /** The title of its page: the note's when a note describes it, the contract's otherwise. */
  title: string;
  summary?: string;
  href: string;
  /** Whether a hand-written note describes the operation; the page flags the operations that have none yet. */
  documented: boolean;
}

/** The contract section of an `api` page: what the model knows of the imported contract, the viewer loading the rest. */
export interface ContractSectionProps {
  title: string;
  /** Empty when the contract declares none. */
  version: string;
  /** ISO 8601 instant of the import. */
  importedAt: string;
  /** The contract location as written in the note: a URL, or a path relative to it. */
  location: string;
  /** The original contract: its URL, or the copy placed next to the page for a path. */
  downloadHref: string;
  /** The JSON view of the contract the viewer fetches on demand, relative to the page. */
  fragmentHref: string;
  /** In model order. */
  operations: ContractOperationItem[];
}

export interface EntityPageProps {
  entity: EntityRef;
  /** The type as the profile declares it; absent for a type the profile does not declare. */
  declaration?: TypeDeclaration;
  /**
   * Qualifying properties, in the order of `display.highlight` of the type: the first two sit
   * next to the badge, the next three on a line under it, the template shows at most five.
   */
  highlights: Attribute[];
  /** The note rendered by the build; the text marks written links and recognised words. */
  sections: Section[];
  /**
   * The side panel: the common properties, then the attributes the type declares in declaration
   * order, then the other declared common attributes the note sets.
   */
  attributes: Attribute[];
  /** The frontmatter keys the profile declares for no type, kept as written, in key order; absent or empty when the note sets none. */
  otherAttributes?: Attribute[];
  labels?: Partial<EntityPageLabels>;
  neighbours: NeighbourhoodProps;
  mentions: MentionsPanelProps;
  sources: SourceRef[];
  /** The documents of the entity beyond its note, in path order; absent or empty for a note alone. */
  documents?: DocumentView[];
  /** The imported contract of an `api` entity; absent for every other page. */
  contract?: ContractSectionProps;
}

export interface Passage {
  context: string;
  /** The expression as written in the passage; the template marks it in the context when it finds it there. */
  text?: string;
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
  /** Number of paragraphs the word shares with the expression. */
  count: number;
  /** Relative co-occurrence frequency, from 1 (rare) to 5 (frequent), by rank of the count among the companions. */
  weight: number;
}

/** The lead to write the missing note: its label, and the new-file page of the glossary on its forge when known. */
export interface CreateNoteLead {
  label: string;
  href?: string;
}

export interface KeywordBanner {
  /** The notice that no note exists, with the number of passages recorded, already localised. */
  text: string;
  createNote: CreateNoteLead;
}

export interface KeywordPageProps {
  /** `typeLabel` names the kind of page, "keyword" in the locale of the site. */
  entity: { id: string; title: string; locale: string; typeLabel: string };
  banner: KeywordBanner;
  counts: { occurrences: number; files: number; sources: number };
  /** Grouped by file, in corpus order. */
  passages: PassageGroup[];
  /** The most frequent first, twelve at most. */
  companions: Companion[];
  /** Expressions with a similar form, offered as a lead. */
  similar: Link[];
  /** The wording of that lead, already localised, which asserts no relation. */
  similarLead: string;
  neighbours: NeighbourhoodProps;
  mentions: MentionsPanelProps;
}

export interface Mention {
  /** A link written in a note, or a file that merely cites the entity. */
  kind: "written" | "recognised";
  file: Link;
  context: string;
  line: number;
  href: string;
  /** The words of the context that name the entity, as written there; the panel marks them. */
  surface?: string;
  /** How the position is named when the file is not a note: `page 3`, `slide 3`, a timecode; the panel shows it instead of the line. */
  location?: string;
}

/** The headings of the two sections of the panel, in the locale of the site. */
export interface MentionsHeadings {
  written: string;
  recognised: string;
}

export interface MentionsPanelProps {
  /** Written links first, then recognised mentions, each group in corpus order. */
  mentions: Mention[];
  /** How many mentions are in the served HTML; the rest is revealed on demand. */
  initial: number;
  /** Absent, the theme uses its own English labels. */
  headings?: MentionsHeadings;
  /** Href, relative to the page, of the JSON fragment holding every mention of the entity; absent when none was written. */
  fragmentHref?: string;
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
  /** A typed entity, drawn as a circle, or a noteless word, drawn as a dashed square with a dashed edge; an entity when absent. */
  kind?: "entity" | "keyword";
  /** The glyph name the profile gives the type (`screen`, `api`…); the theme turns it into a shape inside the node. */
  typeGlyph?: string;
}

export interface NeighbourhoodProps {
  /** Title of the entity at the centre. */
  centre: string;
  /** In the order the model gives, which the panel keeps. */
  neighbours: Neighbour[];
  /**
   * How many one-hop neighbours the entity has in the model. When more than `neighbours` lists,
   * the map gives way to a pointer to the mentions panel; the list stays.
   */
  total?: number;
}

export interface SearchResult {
  title: string;
  href: string;
  typeLabel?: string;
  /** Where the entity is filed: the titles of its application and domain, when it has them. */
  breadcrumb?: string[];
  snippet?: string;
  /** `true` for a keyword page, the page of a recurring expression nobody defined: the row is outlined in dots. */
  keyword?: boolean;
  /** What stands under the title of a keyword page: that no note defines the expression. */
  subtitle?: string;
  /** The counts of a keyword page, "17 occurrences · 6 documents", worded in the site language. */
  detail?: string;
}

export interface FacetValue {
  value: string;
  /** What the value is called; the value itself when absent. */
  label?: string;
  count: number;
  /** The address of the search with this value selected, or lifted when it is active. */
  href: string;
  /** Whether the value is selected. */
  active?: boolean;
  /** Whether selecting the value would keep no result: it is shown, but not followed. */
  disabled?: boolean;
}

export interface Facet {
  name: string;
  label: string;
  values: FacetValue[];
}

/** A selected facet value recalled above the results, with the address of the search without it. */
export interface ActiveFilter {
  name: string;
  value: string;
  /** The facet's own heading, "Type" for instance. */
  facetLabel: string;
  label: string;
  href: string;
}

/** The strings of the results page in the site language; the theme's own when absent. */
export interface SearchResultsLabels {
  facets: string;
  activeFilters: string;
  removeFilter: string;
  clear: string;
  address: string;
  copyAddress: string;
  copied: string;
}

export interface SearchResultsProps {
  query: string;
  total: number;
  results: SearchResult[];
  facets: Facet[];
  /** "218 results", or the no-result notice, already worded in the site language; the theme counts itself when absent. */
  summary?: string;
  active?: ActiveFilter[];
  /** The address of the search with every facet open again; shown with the active filters. */
  clearHref?: string;
  labels?: Partial<SearchResultsLabels>;
  /** The address of the search from the root of the site, `search/index.html?q=…`, shown under the summary so that the state is explicit. */
  address?: string;
  /** Whether the address was just copied: the status line says so. */
  copied?: boolean;
  /**
   * What a facet, an active filter or the clear link does once the search island runs: it
   * follows the address without leaving the page. Never serialised; the served page has links.
   */
  onNavigate?: (href: string) => void;
  /** Copies the address of the search; set by the island when the page has a clipboard. */
  onCopy?: () => void;
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
  /** The `id` of the entry, on the first entry of every letter when the whole index is one page. */
  anchor?: string;
  count: number;
}

export interface IndexProps {
  letters: IndexLetter[];
  /** Letter of the segment shown. */
  current?: string;
  entries: IndexEntry[];
}

export interface TodoEntry extends Link {
  /** Files without markdown for a document, occurrences for a word. */
  count: number;
  /** How many files a word occurs in. */
  files?: number;
}

export interface TodoProps {
  /** Documents without a markdown representation, with their file count. */
  documents: TodoEntry[];
  /** Words above the threshold without a note, with their occurrence and file counts. */
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
