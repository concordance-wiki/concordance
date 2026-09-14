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
  "Spaces",
  "Space",
  "CategoryList",
  "About",
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
  /** A scheme forced on the root as `data-mode`, to preview a palette; absent on a page of the site, where the reader's choice and the system preference decide. */
  scheme?: "light" | "dark";
  children: ComponentChildren;
}

export interface SearchField {
  /** Page the query is submitted to, as a `GET` form with a `q` field. */
  action: string;
  placeholder: string;
  /** Accessible name of the field; the theme's own label when absent. */
  label?: string;
  /** Accessible name of the button clearing the field, shown by the search island once the field holds a query; the theme's own label when absent. */
  clearLabel?: string;
  /**
   * Href of the root of the site from the page, `../` for instance, where `search/` holds the
   * index; absent when the site has no index, and the field then only submits.
   */
  root?: string;
  /** The strings of the live results under the field, worded at build; the island's own English when absent. */
  suggestions?: SuggestionLabels;
  /** The space the field is confined to: the form submits it as the source facet, and the live results keep to it. */
  source?: string;
  /**
   * Facet values the form submits with the query, as hidden fields, by parameter name, which the
   * live results keep to as well: the space and the type of a category list, so that the results
   * open on that category.
   */
  filters?: Readonly<Record<string, string>>;
}

/** A message by plural category of the locale, `#` standing for the number, as the island words a count. */
export type CountForms = Record<string, string>;

/** The strings of the live results a search field shows as the reader types. */
export interface SuggestionLabels {
  /** "N matches", next to the field of the home page. */
  matches: CountForms;
  /** Under the title of a keyword page: "Used in N documents, never defined". */
  usedIn: CountForms;
  /** The detail line of a note, "{type} — {summary}", the placeholders filled in the browser. */
  typeSummary: string;
  /** The detail line of a glossary term: "Glossary term — cited in N pages". */
  glossaryTerm: CountForms;
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
  /** Accessible name of the trail region and of the button unfolding it. */
  title: string;
  pin: string;
  unpin: string;
  /** Follows the number of condensed entries: "… 5 earlier pages". */
  earlier: string;
}

export interface TrailPage {
  id: string;
  title: string;
}

/** The navigation trail folded behind a button of the bar: the pages the reader visited, carried in the URL fragment. */
export interface TrailProps {
  /** Prefix of the hrefs from the page to the site root, `../../` for instance; empty at the root. */
  base: string;
  /** The entity of the page, appended to the trail; absent on the home, index and to-do pages, which carry the trail without entering it. */
  current?: TrailPage;
  labels: TrailLabels;
}

/** The labels the panels island writes on the handles of the side panels once its script runs. */
export interface PanelsLabels {
  /** Title of every handle: "Fold or unfold". */
  fold: string;
  /** Accessible name of the handle of the tree of the space. */
  tree: string;
  /** Accessible name of the handle of the right panel. */
  panel: string;
}

/** The island folding the side panels of a page behind their handles; served empty, it only carries the labels. */
export interface PanelsProps {
  labels: PanelsLabels;
}

/** A side panel of the entity page a reader can fold: the tree of the space, the right panel. */
export type FoldablePanel = "tree" | "panel";

/** A space listed in the drawer of the narrow layouts: a source, its initials and how many notes it holds. */
export interface SpaceLink extends Link {
  /** Two letters standing for the space in its badge. */
  initials: string;
  count: number;
}

/** The spaces entry of the header: its link to the file tree of the home page, and one item per source. */
export interface HeaderSpaces extends Link {
  items: SpaceLink[];
}

/** The labels the default theme writes itself in the header; its own English when absent. */
export interface HeaderLabels {
  /** Accessible name of the button opening the drawer, and of the drawer. */
  menu: string;
  /** The search button of the tablet bar, which unfolds the field. */
  search: string;
  /** The mode switch, a toggle pressed while the dark scheme is displayed. */
  darkMode: string;
}

export interface HeaderProps {
  siteTitle: string;
  homeHref: string;
  logo?: HeaderLogo;
  /** The links of the bar, the index and the recent changes for instance; the spaces have their own entry. */
  navigation: NavigationItem[];
  /**
   * The spaces of the site: a link in the bar where it has room, the list of sources with their
   * initials and counts in the drawer of the narrow layouts; absent, the drawer lists none.
   */
  spaces?: HeaderSpaces;
  /** The tree of the space of the page, unfolded in the drawer of the narrow layouts; absent on a page without a space. */
  space?: SpaceTree;
  search?: SearchField;
  /** Absent, the default theme renders the trail with its own English labels and records no page. */
  trail?: TrailProps;
  /** Absent, the default theme renders the panels island with its own English labels. */
  panels?: PanelsProps;
  /** Whether the drawer of the narrow layouts is served open, to preview it; a page of the site never is. */
  drawerOpen?: boolean;
  labels?: Partial<HeaderLabels>;
}

/** The strings of the footer, worded by the site in its language; the default theme has English ones. */
export interface FooterLabels {
  /** Heading of the first column: what the tool knows of the site. */
  thisSite: string;
  /** The first sentence up to the link counting the repositories, the build instant already worded: "Published on 13 September 2026 at 10:04, from". */
  published: string;
  /** The link to the about page. */
  sources: string;
  /** The sentence naming the generator, in three parts: "Built with", "a static site generator", "under the GNU GPL v3 or later licence." */
  builtWith: string;
  generator: string;
  licence: string;
  /** After the licence: the content belongs to the organisation. */
  content: string;
  /** Heading of the second column: what the organisation declared. */
  declared: string;
  /** The line under the columns, in the monospace family: "publication", the build instant worded, then the profile and the page count, each already worded. */
  publication: string;
  buildAt: string;
  profile: string;
  pages: string;
}

/** The repositories the site is built from, counted, linking to the spaces page. */
export interface FooterRepositories extends Link {
  count: number;
}

/**
 * The footer of every page, in two columns: what the tool knows, then what the organisation
 * declared, the second shown only when something was declared; under them the build line.
 */
export interface FooterProps {
  /** Version of the tool that generated the site. */
  version: string;
  /** ISO 8601 instant of the build. */
  generatedAt: string;
  /** The repositories the site is built from, their count worded in the label; absent, the sentence ends at the build instant. */
  repositories?: FooterRepositories;
  /** Where the about page stands; absent, no link to it. */
  aboutHref?: string;
  /** The profile with its version, "default@1", for the build line. */
  profile?: string;
  /** How many pages the site holds, for the build line. */
  pages?: number;
  /** A paragraph the organisation declares, at the head of the second column. */
  text?: string;
  /** The pages the organisation declares, its legal notice, accessibility statement and personal data page among them, then the links of the theme. */
  links: Link[];
  /** The link to the to-do page with the number of its entries: a build statistic, kept out of the top bar and set on the build line. */
  todo?: NavigationItem;
  /** Whether the tool is named and linked to its repository in the sentence naming the generator; nothing else names it. */
  credit: boolean;
  labels?: Partial<FooterLabels>;
}

/** A space of the home page: a source, how much it holds and when it last moved; its row leads to its page. */
export interface HomeSpace {
  /** The title of the space, as shown. */
  name: string;
  /** The name of the source behind the space, its identifier in the addresses; the title when absent. */
  source?: string;
  /** Where the page of the space stands. */
  href: string;
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
  /** Note under the declared attributes, already worded with their count: "4 declared keys. The rest of the file is free text." */
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
  /** The legend of the three marks of the text: a written link, a recognised word with a note, one without. */
  legendWritten: string;
  legendRecognised: string;
  legendKeyword: string;
  /** Under an image of the sources, before the path of its file. */
  imageNote: string;
  /** The space of the page on the line under the title, already worded with its title: "Space Specifications"; the theme words it from the name of the tree when absent. */
  inSpace: string;
  /** The edit link of the footer under the phone width, next to the name of the file: "Edit". */
  editShort: string;
}

/** A step of the breadcrumb: the space, a folder, the page; the space leads to its page, a folder to its list, the last step is where the reader stands. */
export interface BreadcrumbItem {
  label: string;
  /** Absent on the last step, and on a folder whose address a note takes. */
  href?: string;
}

/** A node of the tree of the current space: a folder with its page count, a page, or the pages a long folder leaves out. */
export interface SpaceNode {
  label: string;
  /** Where a page leads; where the list of a folder opens; absent on the current page, and on a folder whose address a note takes. */
  href?: string;
  /** How many pages a folder holds: what tells a folder from a page. */
  count?: number;
  /** The folders on the way to the current page open, their contents listed; a closed folder shows its count alone. The current page of an API lists its operations. */
  children?: SpaceNode[];
  /** The page of the tree that is the current one, or the folder whose list is the current page. */
  current?: boolean;
  /** A node standing for the pages of a long folder the tree leaves out, its label saying how many. */
  omitted?: boolean;
  /** On the keyword page filed among the notes of its space: how many passages use the word, shown at the end of its line as a folder shows its count. */
  passages?: number;
}

/** The space of a page: the source it comes from, as the reader browses it in the left column. */
export interface SpaceTree {
  /** The title of the space, heading the tree. */
  name: string;
  /** Two letters standing for the space in the badge above the tree. */
  initials: string;
  /** Where the page of the space stands; absent, the head of the tree is plain text. */
  href?: string;
  nodes: SpaceNode[];
}

/** A date on the line under the title: when the note last changed, or since when a word is used. */
export interface ChangeDate {
  /** ISO 8601 date. */
  date: string;
  /** Worded in the language of the site: "changed 9 days ago", "used since March 2026". */
  label: string;
  /** The same in the fewest words, for the line of a narrow page: "9 days ago"; the label stands in when absent. */
  short?: string;
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
  /** Where the file stands on its forge, which its path links to; absent for a local source without a known forge. */
  href?: string;
  /** Where the call to action leads: the edit page of the file on its forge, else the contribution address of the project; absent without either, and the theme shows no call to action. */
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

/**
 * The PDF of a document and the scripts that leaf through it, all hrefs relative to the page;
 * when the PDF is a twin file of the original, what its own reader read from it, for a page
 * whose original states nothing.
 */
export interface DocumentPreview {
  /** The PDF itself, a link without JavaScript and what the viewer opens. */
  href: string;
  /** The viewer bundle, imported on demand when the reader asks for it; never loaded with the page. */
  viewerHref?: string;
  /** The worker of the viewer, loaded by the viewer bundle. */
  workerHref?: string;
  /** The size of the PDF in bytes, when it is a file of the sources the build recorded. */
  size?: number;
  /** The page count the PDF states, when its reader read one. */
  pageCount?: number;
  /** The author the PDF states. */
  author?: string;
  /** ISO 8601 date the PDF states. */
  date?: string;
}

/** One position of a document with its extracted text: a page, a slide or a cue. */
export interface DocumentPosition {
  number: number;
  /** `page 3`, `slide 3`, or a timecode. */
  label: string;
  text: string;
  /** Who speaks a transcript cue; absent for a page, a slide or a cue without a speaker. */
  speaker?: string;
}

/**
 * A document of the entity that is not its note: what the page offers, with or without
 * JavaScript. An office file and the PDF the build keeps next to it are one document: the
 * office file is the original, the PDF its preview.
 */
export interface DocumentView {
  file: DocumentFile;
  preview?: DocumentPreview;
  /** How the positions are named: the pages of a PDF, the slides of a deck, the cues of a transcript. */
  unit: "page" | "slide" | "cue";
  positions: DocumentPosition[];
  /** The size of the original file in bytes, when the build recorded it. */
  size?: number;
  /** The author the file states, as its reader read it. */
  author?: string;
  /** ISO 8601 date the file states, its last modification else its creation; distinct from the commit date. */
  date?: string;
  /** The page or slide count the file states, when its reader read one. */
  pageCount?: number;
  /** Whether the positions, and their unit, are those of the PDF preview, the reader of the original having given no text. */
  positionsFromPreview?: boolean;
}

/** One file of the document as the panel of the document page lists it: the original, its preview, the note. */
export interface DocumentTwinFile {
  /** `.pptx` for the original, `.pdf` for the preview, the file name of the note. */
  label: string;
  /** What the file is, worded in the site language: "original", "preview", "session notes". */
  role: string;
  href?: string;
}

/** The headings, notes and names the document page adds, in the language of the site; the theme's own English when absent. */
export interface DocumentPageLabels {
  /** The tab of the rendered document. */
  document: string;
  /** The tab of the extracted text. */
  extractedText: string;
  /** The tab of the note merged with the document. */
  relatedNotes: string;
  /** Accessible name of the tab bar. */
  views: string;
  /** The button that downloads the original file. */
  downloadOriginal: string;
  /** The heading of the strip of pages. */
  pages: string;
  /** Accessible name of the embedded PDF, shown without JavaScript. */
  preview: string;
  /** The link to the PDF inside the embedded PDF, for a browser that shows none. */
  openPdf: string;
  /** Note under the rendered page: converted at publication, cached by fingerprint. */
  convertedNote: string;
  /** Note under the rendered page: the original stays downloadable. */
  originalNote: string;
  /** Heading of the properties block. */
  properties: string;
  /** Row of the properties block: the kind of the document. */
  type: string;
  author: string;
  /** Row of the properties block: the page count. */
  pageCount: string;
  date: string;
  /** Note under the properties: read from the file, distinct from the repository date. */
  dateNote: string;
  /** Note under the properties: the size or the page count is that of the PDF preview, the original stating none. */
  previewNote: string;
  /** Heading of the block listing the files of the document, the count worded: "Same document, three files". */
  sameDocument: string;
  /** Note under the files: grouped by folder, date and textual overlap, one entry in the index. */
  groupedNote: string;
  /** What the notes tab says when no note is merged with the document. */
  noNote: string;
}

/**
 * What the page of an office document, a deck or a report, shows beyond the generic entity page:
 * the kind, count, size and date of the line under the title and of the properties, the files
 * that make the document. Its presence makes the default theme lay the page out as a document
 * page; the generic entity page is rendered without it.
 */
export interface DocumentPageView {
  /** The kind of the document from its extension, worded: "Presentation". */
  kind: string;
  /** How many pages the document has; absent when nothing counted them. */
  pages?: number;
  /** The count worded in the site language: "24 pages"; the theme words it itself when absent. */
  pagesLabel?: string;
  /** The size of the original worded in the site language: "4.2 MB"; absent when the build did not record it. */
  size?: string;
  /** The date of the document: the one the file states when its reader read one, else the last change in the repository. */
  date?: {
    /** ISO 8601 date. */
    date: string;
    /** Worded in the site language: "12 March 2026". */
    label: string;
    /** Whether the date was read from the file rather than from the repository. */
    fromFile: boolean;
  };
  /** The author the file states; absent when it states none. */
  author?: string;
  /** Whether the size or the page count was read from the PDF preview, the original stating none: the panel says so. */
  fromPreview?: boolean;
  /** The files that make the document: the original, its preview when there is one, the note when there is one. */
  files: DocumentTwinFile[];
  labels?: Partial<DocumentPageLabels>;
}

/** One operation of an imported contract, as the operations table of the API page lists it. */
export interface ContractOperationItem {
  /** The operation name as the contract writes it. */
  name: string;
  /** The title of its page: the note's when a note describes it, the contract's otherwise. */
  title: string;
  summary?: string;
  href: string;
  /** Whether a hand-written note describes the operation; the table lists the operations that have none as gaps. */
  documented: boolean;
  /** The HTTP method of the operation, as the contract or the note declares it; a SOAP operation has none. */
  method?: string;
  /** The path of the operation, as the contract or the note declares it; absent, the table says the path is unknown. */
  path?: string;
  /** How many pages cite the operation, already worded: "2 callers". */
  callers?: string;
}

/** The type of the operations of an API, as the contract import produces them and the notes describe them: what the API page lifts to the top of its related pages. */
export const OPERATION_TYPE = "endpoint";

/** The headings and notes of the contract side of the API page, in the language of the site; the theme's own English when absent. */
export interface ContractLabels {
  /** Heading of the operations table. */
  operations: string;
  /** Sentence under that heading: how the operations were matched. */
  operationsLead: string;
  /** Sentence added when the table holds gap rows. */
  gapsLead: string;
  /** Column headers of the table, for assistive technology. */
  method: string;
  path: string;
  operation: string;
  callersColumn: string;
  /** When the contract declares no operation. */
  noOperation: string;
  /** Gap row of an operation the contract declares that no note describes. */
  withoutPage: string;
  /** Gap row of a note the contract does not declare. */
  notInContract: string;
  /** Path cell of a gap row whose note declares no path. */
  unknownPath: string;
  /** Heading of the contract block. */
  contract: string;
  download: string;
  /** Note next to the viewer: the contract is shown, never copied into the note. */
  viewerNote: string;
  /** Note under the properties, cut to five keys. */
  fiveKeys: string;
  /** Note under the related pages, where the operations come first. */
  operationsFirst: string;
}

/** The contract side of an `api` page: what the model knows of the imported contract, the viewer loading the rest. */
export interface ContractSectionProps {
  title: string;
  /** Empty when the contract declares none. */
  version: string;
  /** The format of the contract with its version, as the record names it: `openapi 3.1`, `wsdl 1.1`. */
  format: string;
  /** ISO 8601 instant the block dates the contract by: the last change of its file, the import of a contract fetched from a URL. */
  importedAt: string;
  /** That instant worded relative to the build, "imported 3 days ago"; the instant stands in when absent. */
  imported?: ChangeDate;
  /** The contract location as written in the note: a URL, or a path relative to it. */
  location: string;
  /** The original contract: its URL, or the copy placed next to the page for a path. */
  downloadHref: string;
  /** The JSON view of the contract the viewer fetches as soon as it runs, relative to the page. */
  fragmentHref: string;
  /** In the order of the contract. */
  operations: ContractOperationItem[];
  /** The `endpoint` notes that name the API and match none of its operations, in identifier order: described, absent from the contract. */
  unmatched?: ContractOperationItem[];
  labels?: Partial<ContractLabels>;
}

/** The headings and notes the page of a meeting adds itself, in the language of the site; the theme's own English when absent. */
export interface MeetingLabels {
  /** Accessible name of the row of tabs, one per representation of the meeting. */
  representations: string;
  /** The tabs: the transcript, the written notes, the deck, any other converted document. */
  transcript: string;
  notes: string;
  deck: string;
  document: string;
  /** Next to the tabs: that the build grouped the files. */
  grouped: string;
  /** Lead of the callout linking the decisions the meeting produced. */
  decision: string;
  /** Under the transcript: that the names are replaced by stable pseudonyms and the mapping never published. */
  pseudonymNote: string;
  /** The rows of the properties block. */
  date: string;
  duration: string;
  space: string;
  files: string;
  /** Under the related pages: that a meeting does not enter the model. */
  relatedNote: string;
}

/** A property of the meeting as the panel shows it: an ISO 8601 date and how the site words it. */
export interface MeetingDate {
  date: string;
  label: string;
}

/** A decision the meeting produced, and the cue of its transcript the decision was recognised in. */
export interface MeetingDecision extends Link {
  /** The number of the last cue of the transcript that names the decision; absent when no cue does. */
  cue?: number;
}

/** The files the build merged into the page of the meeting, and why. */
export interface MeetingGrouping {
  count: number;
  /** The value of the files row, "3 grouped", worded. */
  label: string;
  /** The reasons under the properties, worded: "3 files: same folder, same commit, high textual overlap."; absent when the model recorded none. */
  note?: string;
}

/**
 * What the page of a meeting lays out beyond the generic view model: its date and duration,
 * whether its transcript was pseudonymised, the decisions it produced and the grouping of its
 * files. The tabs come from the sections and the documents of the page.
 */
export interface MeetingProps {
  /** The `date` attribute of the note, worded; absent without one. */
  date?: MeetingDate;
  /** "1 h 12": the `duration` attribute when the note sets one, else the timecode of the last cue of the transcript; absent without either. */
  duration?: string;
  /** Under the title: "Pseudonymised participants" when pseudonymisation applied, else the number of participants the note declares; absent without either. */
  participants?: string;
  /** Whether the transcripts were pseudonymised at build: the note under the transcript says so. */
  pseudonymized: boolean;
  /** The decisions the meeting produced, as the model links them, by identifier, each with the cue it was recognised in; empty when none is linked. */
  decisions: MeetingDecision[];
  /** The files merged into the page, when the build grouped several. */
  grouping?: MeetingGrouping;
  labels?: Partial<MeetingLabels>;
}

/** The headings and notes the page of a decision adds itself, in the language of the site; the theme's own English when absent. */
export interface DecisionLabels {
  /** The rows of the properties block. */
  status: string;
  decidedOn: string;
  supersedes: string;
  supersededBy: string;
  session: string;
  /** Under the properties: "4 keys: the status and the date are authoritative.", the count worded. */
  keysNote: string;
  /** First sentence of the callout, the day of the session filled in: "Decided in session on 12 March." */
  sessionDated: string;
  /** First sentence of the callout for a session without a date. */
  sessionUndated: string;
  /** Second sentence of the callout, the `{minutes}` placeholder standing for the link to the meeting, the time filled in: "The exact passage is in {minutes}, at 13:02." */
  sessionPassage: string;
  /** Second sentence of the callout when no cue names the decision, the `{minutes}` placeholder standing for the link to the meeting. */
  sessionSee: string;
  /** The words of the link to the meeting: "the minutes". */
  sessionMinutes: string;
  /** Under the related pages: that a decision cites what it changes. */
  relatedNote: string;
}

/** The status of a decision: its value as the note writes it, and how the site words it. */
export interface DecisionStatus {
  value: string;
  label: string;
}

/** A meeting the decision was taken in, and the cue of its transcript the decision was recognised in. */
export interface DecisionSession extends Link {
  /** The day of the meeting, worded without its year: "12 March"; absent when its note carries none. */
  date?: string;
  /** The cue of the transcript that names the decision: its timecode worded and the anchor of the cue on the page of the meeting; absent when no cue does. */
  cue?: { time: string; href: string };
}

/**
 * What the page of a decision lays out beyond the generic view model: its status, the day it
 * was decided, the decision it supersedes and the one that supersedes it, the sessions it was
 * taken in. Its presence makes the default theme lay the page out as a decision page.
 */
export interface DecisionProps {
  status: DecisionStatus;
  /** The `date` attribute of the note, worded; absent without one. */
  date?: MeetingDate;
  /** The decision this one replaces, as the model links them. */
  supersedes?: Link;
  /** The decision that replaces this one, as the model links them. */
  supersededBy?: Link;
  /** The meetings the model ties to the decision, by identifier; empty when none is linked. */
  sessions: DecisionSession[];
  labels?: Partial<DecisionLabels>;
}

export interface EntityPageProps {
  entity: EntityRef;
  /** The results page filtered on the type of the page, where the type chip leads; absent, the chip is plain text. */
  typeHref?: string;
  /** The type as the profile declares it; absent for a type the profile does not declare. */
  declaration?: TypeDeclaration;
  /** The space of the page and its tree, for the left column; absent, the page has no left column. */
  space?: SpaceTree;
  /** Space, folders, page; absent, the page has no breadcrumb. */
  breadcrumb?: BreadcrumbItem[];
  /** The last change of the note, on the line under the title; absent when the source recorded none. */
  changed?: ChangeDate;
  /**
   * The properties `display.highlight` of the type puts forward, in its order, as the panel
   * resolves them: the API page leads its five keys with them; the generic page shows them in
   * the panel alone, the line under the title naming nothing the panel says.
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
  /** The imported contract of an `api` entity, which gives the page its own layout; absent for every other page. */
  contract?: ContractSectionProps;
  /** The neighbourhood map served unfolded, the panel replaced by it; folded behind its line when absent. */
  mapOpen?: boolean;
  /** The side panels served folded behind their handles, as a reader who folded them sees the page; every panel open when absent. */
  folded?: FoldablePanel[];
  /** What the page of a `meeting` entity lays out beyond the generic template; absent for every other page. */
  meeting?: MeetingProps;
  /** What lays the page out as the page of an office document; absent for every other page. */
  document?: DocumentPageView;
  /** What the page of a `decision` entity lays out beyond the generic template; absent for every other page. */
  decision?: DecisionProps;
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

/** The passages of a page beyond the ones in view, behind a fold worded by its label. */
export interface PassageFold {
  /** The line that unfolds them, already localised: "3 other passages". */
  label: string;
  passages: Passage[];
}

export interface PassageGroup {
  file: Link;
  /** The title of the page the file belongs to; the file label stands in when absent. */
  title?: string;
  /** The label of the type of that page in the language of the site. */
  typeLabel?: string;
  /** The passages in view: the first ones of the page, two when the page builder groups them. */
  passages: Passage[];
  /** The passages beyond those in view; the count of the group adds them to the ones in view. */
  folded?: PassageFold;
}

/** The pages beyond the ones in view, behind a disclosure worded as the button that shows them. */
export interface PassageGroupFold {
  /** The line that unfolds them, already localised: "Show the 4 other files". */
  label: string;
  groups: PassageGroup[];
}

/** The lead to write the missing note: its label, and the new-file page of the glossary on its forge, else the contribution address of the project; without an address the theme shows no lead. */
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
  /** How many passages use the expression: the occurrences the model counts for a keyword page, the passages that mention a note. */
  count: number;
  /** The other forms a note was met under, its aliases, when the lead reached it through them; absent when the title alone did. */
  aliases?: string[];
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
  /** The passages grouped by page in corpus order, the first pages in view. */
  passages: PassageGroup[];
  /** The pages beyond the ones in view, when the page builder folds them. */
  morePassages?: PassageGroupFold;
  /** Expressions with a similar form, offered as a lead. */
  similar: SimilarExpression[];
  /** The note under that lead, already localised, which asserts no relation. */
  similarLead: string;
  /** Drawn from the co-occurrences of the word: the pages and the words that accompany it most often. */
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
  /** How many passages the citing page holds in all, when a served slice may not carry them all; the passages held count otherwise. */
  passages?: number;
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
  /** "{count} other" and "{count} others": the line unfolding the entries beyond the first three where the panel is condensed, the placeholder replaced by the island. */
  other: string;
  others: string;
  /** Under the list: how it is ordered and what "cited" marks, or how the page relates to the model. */
  orderNote: string;
  /** When no page evokes the entity. */
  noRelated: string;
  /** When no page matches the filters. */
  noMatch: string;
}

export interface MentionsPanelProps {
  /** In the order of the panel: page by page, most passages first, the passages of a page in corpus order. */
  mentions: Mention[];
  /** How many mentions are in the served HTML; the rest is revealed on demand. */
  initial: number;
  /** How many pages cite the entity in all, the served ones included; counted from `mentions` when absent. */
  pages?: number;
  /** Absent, the theme uses its own English labels. */
  labels?: Partial<RelatedLabels>;
  /** Href, relative to the page, of the JSON fragment holding every mention of the entity; absent when none was written. */
  fragmentHref?: string;
  /** A type slug whose pages come first, whatever their passage count: the operations on an API page. */
  leadType?: string;
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

/** The strings of the neighbourhood map in the language of the site; the theme's own English when absent. */
export interface NeighbourhoodLabels {
  /** Heading of the map, before the title of the page at its centre. */
  map: string;
  /** Under the map: that the list carries the same information. */
  mapCaption: string;
  /** Before the distance control. */
  distance: string;
  /** The one distance the model records, worded: "1 hop". */
  hop: string;
  /** The button opening the type filter. */
  types: string;
  /** Legend of a plain edge: a neighbour that has a note. */
  existingPage: string;
  /** Legend of a dotted edge: a neighbour that is a word without a note. */
  noteless: string;
  /** Heading of the list, the count worded: "The 6 neighbours". */
  neighbours: string;
  /** After the heading of the list: that it is the textual equivalent of the map. */
  textualEquivalent: string;
  /** Under the list: why the map stops at six. */
  capNote: string;
  /** When the page has no neighbour. */
  noNeighbour: string;
  /** "{count} neighbours in total, more than the map shows", worded, under the map when the model holds more than it draws. */
  total: string;
  /** The pointer to the mentions panel, after the notice that the page has no neighbour. */
  seeMentions: string;
}

export interface NeighbourhoodProps {
  /** Title of the entity at the centre. */
  centre: string;
  /** In the order the model gives, which the panel keeps. */
  neighbours: Neighbour[];
  /**
   * How many one-hop neighbours the entity has in the model. When more than `neighbours` lists,
   * a sentence under the map says so; the map and the list draw the neighbours listed.
   */
  total?: number;
  /** Absent, the theme uses its own English labels. */
  labels?: Partial<NeighbourhoodLabels>;
}

export interface SearchResult {
  title: string;
  href: string;
  typeLabel?: string;
  /** Where the entity is filed: the titles of its application and domain, when it has them. */
  breadcrumb?: string[];
  /** The summary of the note, shown under the title. */
  snippet?: string;
  /** "cited in 64 pages", worded in the site language, on the line of the first result; absent when nothing cites the page. */
  cited?: string;
  /** How many pages cite the page, the bare count the condensed rows show; absent or 0 when nothing cites it. */
  citedCount?: number;
  /** The line under the summary: the space, then what the note declares, "Also called: VL", "Broader term: payment", each already worded. */
  facts?: string[];
  /** `true` for a keyword page, the page of a recurring expression nobody defined: the row is outlined in dashes, its title dotted. */
  keyword?: boolean;
  /** What stands under the title of a keyword page: that no note defines the expression. */
  subtitle?: string;
  /** The line of a keyword page, "Used in 6 documents, never defined in the glossary", worded in the site language. */
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
  /** Whether the value stands for the words without a note: the default component draws its box dashed, like their rows. */
  keyword?: boolean;
}

export interface Facet {
  name: string;
  label: string;
  values: FacetValue[];
  /** Whether the facet is served folded behind its heading, a secondary one; the primary facets stand open. */
  folded?: boolean;
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
  /** The note under the facets: that the counters are set at publication and the filtering runs in the browser. */
  countersNote: string;
  /** The note under the results: that the words without a note appear dotted among the others. */
  notelessNote: string;
  /** The lead of the closest form proposed when nothing matches. */
  closestForm: string;
}

/** What the empty state proposes: the closest form of the dictionary, with its counts, and the address of the search on it. */
export interface ClosestFormProposal {
  form: string;
  href: string;
  /** "12 occurrences" or "cited in 3 pages", worded in the site language. */
  detail: string;
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
  /** The closest form of the dictionary, proposed when the query matched nothing. */
  closest?: ClosestFormProposal;
  /**
   * What a facet, an active filter or the clear link does once the search island runs: it
   * follows the address without leaving the page. Never serialised; the served page has links.
   */
  onNavigate?: (href: string) => void;
  /**
   * The button under the rows when `results` holds the first of more: its label, "Show the
   * next 20", and what it does, drawing the next rows in place. Set by the island; never serialised.
   */
  more?: { label: string; onMore: () => void };
}

export interface IndexLetter {
  letter: string;
  /** Absent when the letter has no entry: it is shown inactive. */
  href?: string;
  count: number;
  /** The count worded for the heading of the letter, "94 words"; the theme counts alone when absent. */
  countLabel?: string;
}

export interface IndexEntry extends Link {
  /** The letter of the bar the entry files under, `#` for a title opening otherwise. */
  letter: string;
  /** Glyph of the type; absent for a word without a definition. */
  glyph?: string;
  /** The label of the type in the site language; absent for a word without a definition. */
  typeLabel?: string;
  /**
   * The first line of the page, its summary; for a word without a definition, the passage that
   * uses it most, quoted and followed by the title of its file, "“…” — title"; absent when the
   * page has neither.
   */
  summary?: string;
  /** The `id` of the entry, on the first entry of every letter when the whole index is one page. */
  anchor?: string;
  /** How many pages cite the word: the pages linking to a note, the files using an expression. */
  count: number;
}

/** One value of a filter of the index: where it leads, the results page filtered by it, and how many entries it keeps. */
export interface IndexFilterValue extends Link {
  count: number;
}

/** The filters of the index, folded behind their button: every value leads to the results page filtered by it. */
export interface IndexFilters {
  /** The types of the pages with a note, in the order of their labels. */
  types: IndexFilterValue[];
  /** The spaces, the sources of the model, in name order. */
  spaces: IndexFilterValue[];
  /** The words without a definition, as one value. */
  withoutDefinition: IndexFilterValue;
}

/** The strings of the index in the language of the site; the theme's own English when absent. */
export interface IndexLabels {
  title: string;
  /** Under the title, worded with its counts: "2312 words used in the documentation. 569 have a written page, the others exist through their uses alone." */
  lead: string;
  /** The button folding the filters. */
  filters: string;
  byType: string;
  bySpace: string;
  /** Accessible name of the letter bar. */
  letters: string;
  /** After the letter bar, worded with its count: "10 letters without an entry". */
  lettersWithout: string;
  /** The four column headings. */
  word: string;
  type: string;
  description: string;
  pages: string;
  /** In the type column of a word without a definition. */
  noDefinition: string;
  /** The note at the foot of the table. */
  note: string;
}

export interface IndexProps {
  letters: IndexLetter[];
  /** Letter of the segment shown. */
  current?: string;
  entries: IndexEntry[];
  /** How many words the index holds and how many have a note, for the sentence under the title; absent, the theme counts the letters. */
  counts?: { words: number; notes: number };
  /** Absent, the page shows no filter button. */
  filters?: IndexFilters;
  labels?: Partial<IndexLabels>;
}

export interface TodoEntry extends Link {
  /** Files without markdown for a document, occurrences for a word. */
  count: number;
  /** How many files a word occurs in. */
  files?: number;
}

/** An expression at the publication threshold whose confidence set it aside: suspected noise, without a page. */
export interface TodoNoiseEntry {
  label: string;
  /** Occurrences. */
  count: number;
  files: number;
  /** Why the confidence set it aside, already worded: "in 68% of the files, 1.2 per file, verb or adverb form". */
  reason: string;
}

/** The strings of the to-do page in the language of the site; the theme's own English when absent. */
export interface TodoLabels {
  /** The line that unfolds the words after the first hundred, already counted: "Show the 535 others". */
  showOthers: string;
  /** Heading of the suspected noise section. */
  noise: string;
  /** Sentence under that heading: what the list holds and what those expressions lack. */
  noiseNote: string;
  /** The call to contribute: add those words to the project's stopwords. */
  contribute: string;
}

export interface TodoProps {
  /** Documents without a markdown representation, with their file count. */
  documents: TodoEntry[];
  /** Words above the threshold without a note, with their occurrence and file counts. */
  terms: TodoEntry[];
  /** The expressions the confidence set aside, best score first; none when absent. */
  noise?: TodoNoiseEntry[];
  /** Where the call to contribute leads, `project.contribute_url`; without it the call is not shown. */
  contributeHref?: string;
  labels?: Partial<TodoLabels>;
}

/** A row of the spaces page: a source, what it holds, how many pages and when it last moved. */
export interface SpaceRow {
  name: string;
  /** Where the page of the space stands. */
  href: string;
  /** Two letters standing for the space in its badge. */
  initials: string;
  /** What the space holds: the sentence the configuration declares, else the labels of its dominant types; empty for a space without a note. */
  content: string;
  /** How many pages the space holds. */
  count: number;
  /** ISO 8601 date of the newest change among its notes; absent when none carries a git date. */
  date?: string;
  /** The change worded relative to the build, "2 days ago", in days past the threshold, "193 days ago"; the theme shows `date` when absent. */
  dateLabel?: string;
  /** Whether the staleness threshold makes the space dormant: its date is then marked in the accent. */
  stale: boolean;
}

/** The strings of the spaces page in the language of the site; the theme's own English when absent. */
export interface SpacesLabels {
  /** The title of the page. */
  title: string;
  /** Under the title, already counted: how many spaces, and that a repository and a space do not map one to one. */
  lead: string;
  /** The four column headings. */
  space: string;
  content: string;
  pages: string;
  lastUpdate: string;
  /** Under the table, the threshold already worded: where the dates come from and what the accent means. */
  datesNote: string;
  /** After the date of a dormant space, for assistive technology: the alert in words, since the accent is a colour. */
  stale: string;
}

export interface SpacesProps {
  /** Every space of the site, the most cited first. */
  spaces: SpaceRow[];
  labels?: Partial<SpacesLabels>;
}

/** The strings of the about page, worded by the site in its language; the default theme has English ones. */
export interface AboutLabels {
  /** The step of the breadcrumb leading home, and the accessible name of the breadcrumb. */
  home: string;
  breadcrumb: string;
  title: string;
  lead: string;
  /** The figures at the head of the page: the build instant, the pages, the indexed words. */
  publishedOn: string;
  pages: string;
  words: string;
  /** The heading of the sources table and the sentence next to it. */
  sources: string;
  sourcesLead: string;
  /** The five column headings. */
  repository: string;
  nature: string;
  version: string;
  content: string;
  lastChange: string;
  /** Under the table: the versions are those read at publication. */
  versionsNote: string;
  /** Before the name of a dormant source in the sentence under the table: "The source". */
  staleSource: string;
  /** After the date of a dormant source, for assistive technology: the alert in words, since the accent is a colour. */
  stale: string;
  /** What the site does not contain: the lead, the sentence up to the link, the link to the report, the end of the sentence. */
  notContained: string;
  notContainedText: string;
  report: string;
  reportLists: string;
  /** How a page is corrected: the lead, the sentence, the link to the contribution address. */
  correct: string;
  correctText: string;
  contribute: string;
  /** What is pseudonymised: the lead and the sentence, shown when the configuration enables it. */
  pseudonymised: string;
  pseudonymisedText: string;
}

/** One figure at the head of the about page: its label and its value, already worded. */
export interface AboutFigure {
  label: string;
  value: string;
}

/** One source of the site as the about page lists it: the repository, what it holds, the version the build read, how much it kept and when it last changed. */
export interface AboutSource {
  /** The name of the source, the repository as declared. */
  name: string;
  /** What the repository holds: its title when the configuration gives one, else the labels of its dominant types. */
  nature: string;
  /** The commit the build read, shortened; absent for a source without a git history. */
  version?: string;
  /** How much the site kept, worded: "312 pages", "205 documents". */
  content: string;
  /** ISO 8601 date of the newest change among its notes; absent when none carries a git date. */
  date?: string;
  /** The change worded relative to the build, "2 days ago", or in days for a dormant source; the theme shows `date` when absent. */
  dateLabel?: string;
  /** Whether the staleness threshold makes the source dormant: its date reads in the accent, doubled by its value in days. */
  stale: boolean;
  /** The threshold that makes the source dormant, in days; present for a dormant source alone. */
  threshold?: number;
  /** The sentence under the table after the name of a dormant source, the threshold already worded: "exceeds the freshness threshold of 180 days, which is reported here…"; the theme words it from `threshold` when absent. */
  staleNote?: string;
}

export interface AboutProps {
  /** Where the home page stands, for the breadcrumb. */
  homeHref: string;
  /** ISO 8601 instant of the build. */
  generatedAt: string;
  /** The build instant, the page count, the indexed words and, when known, the duration, each already worded. */
  figures: AboutFigure[];
  /** Every source of the site, the most cited first. */
  sources: AboutSource[];
  /** How many occurrences a word needs before it gets a page: what the site leaves out below it. */
  threshold: number;
  /** Where the publication report stands: the to-do page. */
  reportHref: string;
  /** Where the contribution address of the configuration leads; absent, no link. */
  contributeHref?: string;
  /** Whether the transcripts are pseudonymised: the page says so. */
  pseudonymised: boolean;
  /** The sections of the markdown file the configuration names, rendered after the generated content. */
  sections?: Section[];
  labels?: Partial<AboutLabels>;
}

/** A category of a space: a top-level folder of its repository, with the list it opens. */
export interface SpaceCategory extends Link {
  /** One sentence on what the folder holds; absent when nothing declares one. */
  description?: string;
  /** How many pages the folder holds. */
  count: number;
}

/** A page of a space changed last: where it leads, its category and when it changed. */
export interface SpaceChange extends Link {
  /** The top-level folder the page is filed under; absent for a page at the root of the repository. */
  category?: string;
  /** ISO 8601 date of the change. */
  date: string;
  /** The change worded relative to the build, "4 days ago"; the theme shows `date` when absent. */
  dateLabel?: string;
}

/** A word cited in a space: a page with how many times the notes of the space cite it. */
export interface SpaceWord extends Link {
  count: number;
  /** `true` for a keyword page, the page of a recurring expression nobody defined: the chip is dashed. */
  keyword?: boolean;
  /** What the dashed chip tells on hover and to assistive technology, "6 passages, no note"; the theme words "no note" when absent. */
  title?: string;
}

/** The strings of a space page in the language of the site; the theme's own English when absent. */
export interface SpaceLabels {
  /** Accessible name of the breadcrumb. */
  breadcrumb: string;
  /** The first step of the breadcrumb, the spaces page. */
  spaces: string;
  /** The count worded, "486 pages". */
  pages: string;
  /** Before the repository name: "repository". */
  repository: string;
  /** The newest change worded, "updated 4 days ago"; absent when no note carries a git date. */
  updated?: string;
  /** Heading of the categories. */
  browse: string;
  /** After that heading, already counted: "5 categories, as filed in the repository". */
  categoriesLead: string;
  /** Under the categories: that each one opens a list and that the page carries no tree. */
  categoriesNote: string;
  /** Heading of the recent changes. */
  recent: string;
  /** Heading of the most cited words. */
  mostCited: string;
  /** Under the words: that they are counted in the space only. */
  wordsNote: string;
  /** The closing sentence of the page. */
  footer: string;
}

export interface SpaceProps {
  name: string;
  /** Two letters standing for the space in its badge. */
  initials: string;
  /** The sentence the configuration declares for the source; absent when it declares none. */
  description?: string;
  /** Where the spaces page stands, the first step of the breadcrumb. */
  spacesHref: string;
  /** The name of the repository the space is fed by, on the line under the title. */
  repository: string;
  /** How many pages the space holds. */
  count: number;
  /** ISO 8601 date of the newest change among its notes; absent when none carries a git date. */
  date?: string;
  /** The top-level folders of the repository, in name order. */
  categories: SpaceCategory[];
  /** The pages of the space changed last, newest first, four at most. */
  recent: SpaceChange[];
  /** The pages the notes of the space cite most, five at most. */
  words: SpaceWord[];
  labels?: Partial<SpaceLabels>;
}

/** A row of a category list: a page of the folder, the value of the highlighted attribute, its first line and how many pages relate to it. */
export interface CategoryRow {
  title: string;
  href: string;
  /** The values of the highlighted attribute, linked when they name a page; empty when the page sets none. */
  values: AttributeValue[];
  /** The keys of those values, what the attribute filter matches; empty with the values. */
  keys: string[];
  /** The first line of the page, its summary; absent when the note has none. */
  summary?: string;
  /** How many pages relate to the page: its one-hop neighbours in the model. */
  links: number;
}

/** What a category list is ordered by: the title, or the number of related pages, most first. */
export type CategorySort = "title" | "links";

/** An entry of a selector of the list: a link to the pre-rendered variant, or a choice the island applies in place when it has no address. */
export interface CategoryChoice {
  label: string;
  /** The key of the choice: the sort, or the key of an attribute value; absent for the entry lifting the filter. */
  key?: string;
  href?: string;
  active: boolean;
}

/** The attribute filter of the list: the first highlighted attribute of the type, its values as choices. */
export interface CategoryFilter {
  /** The label of the attribute, heading the selector and the column. */
  label: string;
  /** The entry lifting the filter first, then every distinct value in collation order. */
  choices: CategoryChoice[];
}

/** A page of the list among its pages of twenty, the current one without an address. */
export interface CategoryPage {
  number: number;
  href?: string;
}

/** The strings the list adds itself, in the site language; the theme's own English when absent. */
export interface CategoryListLabels {
  /** Accessible name of the tree of the space. */
  spaceTree: string;
  /** Accessible name of the breadcrumb. */
  breadcrumb: string;
  /** Accessible name of the sort selector. */
  sort: string;
  /** The two entries of the sort selector. */
  sortTitle: string;
  sortLinks: string;
  /** The entry of the attribute selector lifting the filter. */
  all: string;
  /** Heading of the summary column. */
  firstLine: string;
  /** Heading of the column counting the related pages. */
  links: string;
  /** Accessible name of the page links. */
  pagination: string;
  /** "{shown} screens of {total} — pagination by twenty.", the two placeholders replaced by the list. */
  shownOf: string;
  /** The note under the list on what the links column counts. */
  note: string;
}

export interface CategoryListProps {
  /** The folder name, capitalised. */
  title: string;
  /** The space of the folder and its tree: the folders of the space with their counts, this one marked. */
  space: SpaceTree;
  /** Spaces › space › folder. */
  breadcrumb: BreadcrumbItem[];
  /** "64 screens described. A screen is a page of the application, with what it shows and what it allows.", or "64 pages." for a folder mapping to no type. */
  lead: string;
  /** Heading of the first column: the label of the type, or "Page". */
  unit: string;
  /** The attribute filter; absent when the folder maps to no type or the type highlights no attribute. */
  filter?: CategoryFilter;
  /** The sort of the list, and the two choices of its selector. */
  sort: CategorySort;
  sorts: CategoryChoice[];
  /** The rows of the page of the list shown; every row of the list when the island sorts and filters. */
  rows: CategoryRow[];
  /** The current page among the pages of the list. */
  page: number;
  pages: CategoryPage[];
  /** How many rows the whole list holds under the filter; the rows given when absent. */
  total?: number;
  /**
   * Whether the sort and the filter are applied in place by the island, which then receives every
   * row; the served page shows the rows of `page` in the order of `sort`, and the selectors only
   * once the island runs. Otherwise every choice links to a pre-rendered variant.
   */
  island?: boolean;
  labels?: Partial<CategoryListLabels>;
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
  Spaces: SpacesProps;
  Space: SpaceProps;
  CategoryList: CategoryListProps;
  About: AboutProps;
}
