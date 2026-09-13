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
  /** The strings of the live results under the field, worded at build; the island's own English when absent. */
  suggestions?: SuggestionLabels;
}

/** A message by plural category of the locale, `#` standing for the number, as the island words a count. */
export type CountForms = Record<string, string>;

/** The strings of the live results a search field shows as the reader types. */
export interface SuggestionLabels {
  /** "N matches", next to the field of the home page. */
  matches: CountForms;
  /** Under the title of a keyword page: "Used in N documents, never defined". */
  usedIn: CountForms;
  /** The keyboard help: the arrow keys "browse", the Enter key "open". */
  browse: string;
  enter: string;
  open: string;
  /** The link to the results page: "See the N results". */
  seeResults: CountForms;
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
  /** The link to the to-do page with the number of its entries: a build statistic, kept out of the top bar. */
  todo?: NavigationItem;
  /** Whether the discreet credit of the tool, a link to its repository, is shown; nothing else names it. */
  credit: boolean;
}

/** A space of the home page: a source, how much it holds and when it last moved, its tree folded behind its row. */
export interface HomeSpace {
  name: string;
  /** Two letters standing for the space in its badge. */
  initials: string;
  /** How many pages the space holds. */
  count: number;
  /** What the count counts: `documents` when the notes of the space mostly stand for converted documents, `pages` otherwise. */
  unit: "pages" | "documents";
  /** The count worded in the language of the site, "312 pages"; the theme words it itself when absent. */
  countLabel?: string;
  /** ISO 8601 date of the newest change among its notes; absent when none carries a git date. */
  date?: string;
  /** The change worded relative to the build, "2 days ago"; the theme shows `date` when absent. */
  dateLabel?: string;
  /** Whether the staleness threshold makes the space dormant. */
  stale: boolean;
  /** The whole tree of the space, every folder open, drawn as the tree of the entity page. */
  nodes: SpaceNode[];
}

/** A page of the list of recent changes: where it leads, its space and when it changed. */
export interface HomeChange extends Link {
  space: string;
  /** ISO 8601 date of the change. */
  date: string;
  /** The change worded relative to the build, "4 days ago"; the theme shows `date` when absent. */
  dateLabel?: string;
}

/** The alert on a dormant space, worded by the build: its title, the space it names, the note on the threshold. */
export interface HomeAlert {
  /** "A space has not moved for 193 days". */
  title: string;
  space: string;
  /** "framing. The alert threshold is set to 180 days in the configuration." */
  text: string;
}

/** The strings of the home page in the language of the site; the theme's own English when absent. */
export interface HomeLabels {
  /** The question that heads the page. */
  question: string;
  /** Under the question: that every word used anywhere has a page. */
  explanation: string;
  /** Lead of the shortcuts. */
  mostCited: string;
  /** Heading of the spaces. */
  spaces: string;
  /** After that heading: that the spaces come from the repositories. */
  spacesLead: string;
  /** The line folding the spaces beyond the first ones, already counted: "3 more spaces, less cited". */
  moreSpaces: string;
  /** Under the spaces: where their dates come from. */
  datesNote: string;
  /** Heading of the recent changes. */
  recent: string;
}

export interface HomeProps {
  search?: SearchField;
  /** The most cited pages, offered as shortcuts under the search field. */
  shortcuts: Link[];
  /** The spaces in view, most cited first. */
  spaces: HomeSpace[];
  /** The spaces beyond the first ones, folded behind a line counting them; absent or empty when every space is in view. */
  moreSpaces?: HomeSpace[];
  /** The pages changed last, newest first. */
  recent: HomeChange[];
  /** One alert per dormant space, in the order of the spaces. */
  alerts: HomeAlert[];
  labels?: Partial<HomeLabels>;
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

/** The headings and notes the generic page adds itself, in the language of the site; the theme's own English when absent. */
export interface EntityPageLabels {
  /** Heading of the panel of declared attributes. */
  properties: string;
  /** Note under the declared attributes: that they come from the top of the file. */
  declaredAtTop: string;
  /** Heading of the section listing the attributes the type does not declare. */
  otherAttributes: string;
  /** Heading of the table of contents of the note. */
  onThisPage: string;
  /** Accessible name of the tree of the space. */
  spaceTree: string;
  /** Accessible name of the breadcrumb. */
  breadcrumb: string;
  /** The question before the edit link of the footer. */
  correction: string;
  /** The edit link of the footer. */
  edit: string;
  /** The line that unfolds the neighbourhood. */
  seeNeighbourhood: string;
  /** How many pages the neighbourhood holds, already worded: "5 pages". */
  neighbourPages: string;
}

/** A step of the breadcrumb: the space, a folder, the page; only the space has a page of its own. */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** A node of the tree of the current space: a folder with its page count, a page, or the pages a long folder leaves out. */
export interface SpaceNode {
  label: string;
  /** Where a page leads; a folder has none. */
  href?: string;
  /** How many pages a folder holds. */
  count?: number;
  /** The folders on the way to the current page open, their contents listed; a closed folder shows its count alone. */
  children?: SpaceNode[];
  /** The page of the tree that is the current one. */
  current?: boolean;
  /** A node standing for the pages of a long folder the tree leaves out, its label saying how many. */
  omitted?: boolean;
}

/** The space of a page: the source it comes from, as the reader browses it in the left column. */
export interface SpaceTree {
  name: string;
  /** Two letters standing for the space in the badge above the tree. */
  initials: string;
  nodes: SpaceNode[];
}

/** A date on the line under the title: when the note last changed, or since when a word is used. */
export interface ChangeDate {
  /** ISO 8601 date. */
  date: string;
  /** Worded in the language of the site: "changed 9 days ago", "used since March 2026". */
  label: string;
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
  /** The space of the page and its tree, for the left column; absent, the page has no left column. */
  space?: SpaceTree;
  /** Space, folders, page; absent, the page has no breadcrumb. */
  breadcrumb?: BreadcrumbItem[];
  /** The last change of the note, on the line under the title; absent when the source recorded none. */
  changed?: ChangeDate;
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
  /**
   * Where the passage stands, worded: the timecode of a transcript cue, the page or the slide of
   * a converted document, else the line; the theme shows the line when absent.
   */
  location?: string;
}

export interface PassageGroup {
  file: Link;
  /** The title of the page the file belongs to; the file label stands in when absent. */
  title?: string;
  /** The label of the type of that page in the language of the site. */
  typeLabel?: string;
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
  /** The notice that no note exists, with the number of passages that use the word, already localised. */
  text: string;
  /** What the page is built from and what happens when a note is written, already localised; absent, the notice is its text alone. */
  detail?: string;
  createNote: CreateNoteLead;
}

/** An expression of a similar form, offered as a lead from a keyword page. */
export interface SimilarExpression extends Link {
  /** How many occurrences the model counts for the expression; absent for a note. */
  count?: number;
}

/** The headings and notes the keyword page adds itself, in the language of the site; the theme's own English when absent. */
export interface KeywordPageLabels {
  /** Accessible name of the tree of the space. */
  spaceTree: string;
  /** Accessible name of the breadcrumb. */
  breadcrumb: string;
  /** The mark on the line under the title: that no note defines the word. */
  noDefinition: string;
  /** Heading of the passages. */
  passages: string;
  /** Heading of the block of counts. */
  whatWeKnow: string;
  occurrences: string;
  files: string;
  spaces: string;
  /** Note under the counts: that the word has no file, hence no property. */
  noProperty: string;
  /** Heading of the block of expressions with a similar form. */
  maybeSame: string;
  /** Heading of the block of accompanying words. */
  companions: string;
  /** When the word shares no paragraph with another page. */
  noCompanion: string;
  /** The line that unfolds the neighbourhood. */
  seeNeighbourhood: string;
  /** How many pages the neighbourhood holds, already worded: "5 pages". */
  neighbourPages: string;
}

export interface KeywordPageProps {
  /** `typeLabel` names the kind of page, "keyword" in the locale of the site. */
  entity: { id: string; title: string; locale: string; typeLabel: string };
  /** The space the word is filed in, the glossary when there is one, its tree with the word as the current page; absent, the page has no left column. */
  space?: SpaceTree;
  /** Space › terms › word; absent, the page has no breadcrumb. */
  breadcrumb?: BreadcrumbItem[];
  /** Since when the word is used: the oldest change among the files that use it; absent when none carries a date. */
  usedSince?: ChangeDate;
  banner: KeywordBanner;
  counts: { occurrences: number; files: number; sources: number };
  /** The names of the spaces the passages come from, in corpus order. */
  spaces: string[];
  /** The sentence under the passages heading, "6 files.", already localised. */
  summary: string;
  /** Grouped by file, in corpus order. */
  passages: PassageGroup[];
  /** The most frequent first, twelve at most. */
  companions: Companion[];
  /** Expressions with a similar form, offered as a lead. */
  similar: SimilarExpression[];
  /** The note under that lead, already localised, which asserts no relation. */
  similarLead: string;
  neighbours: NeighbourhoodProps;
  mentions: MentionsPanelProps;
  labels?: Partial<KeywordPageLabels>;
}

export interface Mention {
  /** A link written in a note, or a file that merely cites the entity. */
  kind: "written" | "recognised";
  file: Link;
  /** The title of the page that cites the entity; the file label stands in when absent. */
  title?: string;
  /** The type of the citing page, as a slug, which the related pages filter by. */
  type?: string;
  /** The label of that type in the language of the site. */
  typeLabel?: string;
  context: string;
  line: number;
  href: string;
  /** The words of the context that name the entity, as written there; the panel marks them. */
  surface?: string;
  /** How the position is named when the file is not a note: `page 3`, `slide 3`, a timecode; the panel shows it instead of the line. */
  location?: string;
}

/** The strings of the related pages block in the language of the site; the theme's own English when absent. */
export interface RelatedLabels {
  /** Heading of the block. */
  related: string;
  /** Placeholder of the text filter. */
  filterPages: string;
  /** The button opening the type filter. */
  types: string;
  /** "{shown} of {total} pages", the two placeholders replaced by the island. */
  pagesOf: string;
  /** Lifts every type filter. */
  clearAll: string;
  /** Prefix of an entry whose page writes a link to the current one. */
  cited: string;
  /** "passage" and "passages", after the count of an entry. */
  passage: string;
  passages: string;
  /** "Show the {count} others", the placeholder replaced by the island. */
  showOthers: string;
  /** Shown while the others load. */
  loadingOthers: string;
  /** Shown when the others could not be loaded. */
  othersUnavailable: string;
  /** The link to the JSON fragment, before the island runs. */
  fullList: string;
  /** Under the list: how it is ordered and what "cited" marks. */
  orderNote: string;
  /** When no page evokes the entity. */
  noRelated: string;
  /** When no page matches the filters. */
  noMatch: string;
}

export interface MentionsPanelProps {
  /** Written links first, then recognised mentions, each group in corpus order. */
  mentions: Mention[];
  /** How many mentions are in the served HTML; the rest is revealed on demand. */
  initial: number;
  /** How many pages cite the entity in all, the served ones included; counted from `mentions` when absent. */
  pages?: number;
  /** Absent, the theme uses its own English labels. */
  labels?: Partial<RelatedLabels>;
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
