import type { JSX } from "preact";

import type {
  Attribute,
  BreadcrumbItem,
  EntityPageLabels,
  EntityPageProps,
  EntityRef,
  NeighbourhoodProps,
  Section,
  SourceRef,
  SpaceTree as SpaceTreeModel,
} from "../../slots.js";
import { withImageNotes } from "../../markdown/figures.js";
import { useSectionPart, useSlot } from "../context.js";
import { AttributeList, AttributeValues } from "./attributes.js";
import { DocumentBlock } from "./document-viewer.js";
import { labels } from "./labels.js";
import { fill } from "./mention-list.js";
import { NeighbourhoodIcon } from "./neighbourhood.js";
import { SpaceTree } from "./space-tree.js";

/** How many highlights sit on the badge line; the next ones go on a line of their own. */
export const HIGHLIGHTS_WITH_BADGE = 2;
/** How many highlights the header shows in all; the rest stays in the panel. */
export const HIGHLIGHTS_MAX = 5;

/** The labels of the default theme, used for every label the page does not receive; the neighbour and key counts and the name of the space are worded from the page. */
export function defaultEntityPageLabels(
  neighbours: number,
  declared = 0,
  space = "",
): EntityPageLabels {
  return {
    properties: labels.properties,
    declaredAtTop: fill(declared === 1 ? labels.declaredKey : labels.declaredKeys, {
      count: declared,
    }),
    otherAttributes: labels.otherAttributes,
    onThisPage: labels.onThisPage,
    spaceTree: labels.spaceTree,
    breadcrumb: labels.breadcrumb,
    correction: labels.correction,
    edit: labels.edit,
    seeNeighbourhood: labels.seeNeighbourhood,
    neighbourPages: `${String(neighbours)} ${labels.neighbourPages}`,
    legendWritten: labels.legendWritten,
    legendRecognised: labels.legendRecognised,
    legendKeyword: labels.legendKeyword,
    imageNote: labels.imageNote,
    inSpace: fill(labels.inSpace, { space }),
  };
}

/** The space of the page on the line under the title, "Space Specifications", leading to the page of the space when the tree knows it. */
/** The type of the page as a chip, leading to the results filtered on that type when the page knows where. */
export function TypeBadge({ label, href }: { label: string; href?: string }): JSX.Element {
  return href === undefined ? (
    <span class="badge">{label}</span>
  ) : (
    <a class="badge" href={href}>
      {label}
    </a>
  );
}

export function SpaceMark({ space, label }: { space: SpaceTreeModel; label: string }): JSX.Element {
  return space.href === undefined ? (
    <span class="entity-space">{label}</span>
  ) : (
    <a class="entity-space" href={space.href}>
      {label}
    </a>
  );
}

function Highlight({
  entity,
  attribute,
}: {
  entity: EntityRef;
  attribute: Attribute;
}): JSX.Element {
  return (
    <span class="highlight">
      <span class="highlight-label">{attribute.label}</span>{" "}
      <AttributeValues entity={entity} attribute={attribute} />
    </span>
  );
}

/** A section as the build rendered it, the note of the theme set under each image of the sources. */
function PlainSection({
  section,
  imageNote,
}: {
  section: Section;
  imageNote: string;
}): JSX.Element {
  return (
    <section id={section.id}>
      {section.heading !== undefined && <h2>{section.heading}</h2>}
      <div
        class="markdown"
        dangerouslySetInnerHTML={{ __html: withImageNotes(section.html, imageNote) }}
      />
    </section>
  );
}

/** A mapped section of the note, through the `Section@<key>` component of the theme or of the type module when one exists. */
function MappedSection({
  entity,
  section,
  sectionKey,
  imageNote,
}: {
  entity: EntityRef;
  section: Section;
  sectionKey: string;
  imageNote: string;
}): JSX.Element {
  const Part = useSectionPart(entity.type, sectionKey);
  return Part === undefined ? (
    <PlainSection section={section} imageNote={imageNote} />
  ) : (
    <Part entity={entity} section={section} />
  );
}

/** A section of the note: plain, or through the component of its mapped key when there is one. */
/** A section of the note: mapped through its `Section@<key>` component when the type has one, plain otherwise. */
export function NoteSection({
  entity,
  section,
  imageNote,
}: {
  entity: EntityRef;
  section: Section;
  imageNote: string;
}): JSX.Element {
  return section.key === undefined ? (
    <PlainSection section={section} imageNote={imageNote} />
  ) : (
    <MappedSection
      entity={entity}
      section={section}
      sectionKey={section.key}
      imageNote={imageNote}
    />
  );
}

/** One step of the breadcrumb: the current page is marked, a folder without a page is plain text. */
function Crumb({ item, current }: { item: BreadcrumbItem; current: boolean }): JSX.Element {
  if (current) return <span aria-current="page">{item.label}</span>;
  if (item.href === undefined) return <span>{item.label}</span>;
  return <a href={item.href}>{item.label}</a>;
}

/** Space › folder › page: the space links to its place on the home page, the page is where the reader stands. */
export function Breadcrumb({
  items,
  label,
}: {
  items: BreadcrumbItem[];
  label: string;
}): JSX.Element {
  const last = items.length - 1;
  return (
    <nav class="breadcrumbs" aria-label={label}>
      <ol class="breadcrumbs-list">
        {items.map((item, index) => (
          <li key={item.href ?? item.label}>
            <Crumb item={item} current={index === last} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A block of the right panel: a disclosure whose summary is the heading, served closed and
 * unfolded by the stylesheet where the layout has room for the panel.
 */
export function PanelBlock({
  id,
  className,
  heading,
  count,
  children,
}: {
  id: string;
  className: string;
  heading: string;
  /** How many entries the block holds, shown after the heading where the block is folded. */
  count?: number;
  children: JSX.Element | (JSX.Element | false)[];
}): JSX.Element {
  return (
    <section class={`panel-block ${className}`} aria-labelledby={id}>
      <details class="panel-fold">
        <summary>
          <h2 id={id}>
            {heading}
            {count !== undefined && <span class="count panel-count">{count}</span>}
          </h2>
        </summary>
        {children}
      </details>
    </section>
  );
}

/** The table of contents: one entry per section of the note with a heading. */
function TableOfContents({
  sections,
  heading,
}: {
  sections: Section[];
  heading: string;
}): JSX.Element {
  return (
    <PanelBlock id="entity-toc" className="entity-toc" heading={heading}>
      <ol class="toc-list">
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.heading}</a>
          </li>
        ))}
      </ol>
    </PanelBlock>
  );
}

/** The path of the file in the monospace family, linked to the file on its forge when known, then the call to action when it has somewhere to lead. */
export function Source({
  source,
  text,
}: {
  source: SourceRef;
  text: EntityPageLabels;
}): JSX.Element {
  const path = (
    <code>
      {source.source}/{source.path}
    </code>
  );
  return (
    <p class="entity-source">
      {source.href === undefined ? (
        path
      ) : (
        <a class="entity-source-file" href={source.href}>
          {path}
        </a>
      )}
      {source.editHref !== undefined && (
        <span class="entity-edit-lead">
          {text.correction}{" "}
          <a class="entity-edit" href={source.editHref}>
            {text.edit}
          </a>
        </span>
      )}
    </p>
  );
}

/**
 * The neighbourhood folded behind its line at the foot of the panel, a decorative mark before
 * the lead and the number of pages the map draws worded after it. Open, the summary turns into
 * the head of the map, a back control before the title of the map and the name of the page: the
 * stylesheet swaps the two wordings on the state of the disclosure, and where the panel has a
 * column it hides the other blocks, so that the map takes the panel and never the page; without
 * any script the map simply unfolds under the blocks.
 */
export function NeighbourhoodFold({
  neighbours,
  labels: given,
  open = false,
}: {
  neighbours: NeighbourhoodProps;
  labels: Partial<EntityPageLabels>;
  /** Served unfolded; folded when absent. */
  open?: boolean;
}): JSX.Element {
  const Neighbourhood = useSlot("Neighbourhood");
  const text = {
    ...defaultEntityPageLabels(neighbours.neighbours.length),
    ...given,
  };
  return (
    <details class="neighbourhood-fold" open={open}>
      <summary>
        <NeighbourhoodIcon />
        <span class="neighbourhood-lead">{text.seeNeighbourhood}</span>
        <span class="neighbourhood-count">{text.neighbourPages}</span>
        <span class="neighbourhood-head">{neighbours.labels?.map ?? labels.neighbourhoodMap}</span>
        <span class="neighbourhood-page">{neighbours.centre}</span>
      </summary>
      <Neighbourhood {...neighbours} />
    </details>
  );
}

/**
 * The page of every typed entity, whatever its type: the tree of its space on the left; in the
 * centre the breadcrumb, the title, the line naming the type, the last change and the space
 * with the highlights, the note at full column width, its documents under it, the contract of
 * an API after it, then the foot of the article, the legend of the two marks of the text with
 * the path of the file and its edit link; on the right three stacked
 * blocks, the declared attributes (and the attributes the type does not declare, when the note
 * sets some), the table of contents of the note, the related pages, then the neighbourhood
 * folded behind its line. An attribute value or a mapped section goes through the
 * `Attribute@<name>` or `Section@<key>` component of the theme or of the type module when one
 * exists; the rest of the page is the same for every type. `mapOpen` serves the neighbourhood
 * unfolded, as the reader sees it after opening its line. The default theme hands a meeting,
 * whose view model carries what its files bring, to the meeting template on the same shell.
 * with the highlights, the note at full column width, its documents under it, then the foot of
 * the article, the legend of the two marks of the text with the path of the file and its edit
 * link; on the right three stacked blocks, the declared attributes (and the attributes the type
 * does not declare, when the note sets some), the table of contents of the note, the related
 * pages, then the neighbourhood folded behind its line. An attribute value or a mapped section
 * goes through the `Attribute@<name>` or `Section@<key>` component of the theme or of the type
 * module when one exists; the rest of the page is the same for every type. `mapOpen` serves the
 * neighbourhood unfolded, as the reader sees it after opening its line. An API whose contract
 * was imported has a page of its own, `ApiPage`, which the theme serves in its place.
 * whose view model carries what its files bring, to the meeting template on the same shell, and
 * an entity the build laid out as a document page, an office document with what the page says
 * of it, to the document template.
 */
export function EntityPage({
  entity,
  typeHref,
  space,
  breadcrumb = [],
  changed,
  highlights,
  sections,
  attributes,
  otherAttributes = [],
  labels: given = {},
  neighbours,
  mentions,
  sources,
  documents = [],
  mapOpen = false,
}: EntityPageProps): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  const text: EntityPageLabels = {
    ...defaultEntityPageLabels(
      neighbours.total ?? neighbours.neighbours.length,
      attributes.length,
      space?.name ?? "",
    ),
    ...given,
  };
  const withBadge = highlights.slice(0, HIGHLIGHTS_WITH_BADGE);
  const underBadge = highlights.slice(HIGHLIGHTS_WITH_BADGE, HIGHLIGHTS_MAX);
  const headed = sections.filter((section) => section.heading !== undefined);
  return (
    <div class={space === undefined ? "entity" : "entity entity-with-space"}>
      {space !== undefined && <SpaceTree space={space} label={text.spaceTree} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <p class="entity-badge">
            <TypeBadge
              label={entity.typeLabel}
              {...(typeHref === undefined ? {} : { href: typeHref })}
            />
            {changed !== undefined && (
              <time class="entity-changed" dateTime={changed.date}>
                <span class="entity-changed-long">{changed.label}</span>
                <span class="entity-changed-short">{changed.short ?? changed.label}</span>
              </time>
            )}
            {space !== undefined && <SpaceMark space={space} label={text.inSpace} />}
            {withBadge.map((attribute) => (
              <Highlight key={attribute.name} entity={entity} attribute={attribute} />
            ))}
          </p>
          {underBadge.length > 0 && (
            <p class="entity-highlights">
              {underBadge.map((attribute) => (
                <Highlight key={attribute.name} entity={entity} attribute={attribute} />
              ))}
            </p>
          )}
        </header>
        <article class="entity-body">
          {sections.map((section) => (
            <NoteSection
              key={section.id}
              entity={entity}
              section={section}
              imageNote={text.imageNote}
            />
          ))}
          {documents.map((document, index) => (
            <DocumentBlock key={document.file.href} document={document} index={index + 1} />
          ))}
        </article>
        <footer class="entity-footer">
          {sections.length > 0 && (
            <p class="legend">
              <span class="legend-written">{text.legendWritten}</span>
              <span class="legend-recognised">{text.legendRecognised}</span>
              <span class="legend-keyword">{text.legendKeyword}</span>
            </p>
          )}
          {sources.map((source) => (
            <Source key={source.path} source={source} text={text} />
          ))}
        </footer>
      </div>
      <div class="entity-side">
        {attributes.length > 0 && (
          <PanelBlock
            id="entity-properties"
            className="entity-panel"
            heading={text.properties}
            count={attributes.length}
          >
            <AttributeList entity={entity} attributes={attributes} />
            <p class="panel-note">{text.declaredAtTop}</p>
          </PanelBlock>
        )}
        {otherAttributes.length > 0 && (
          <PanelBlock
            id="entity-other-attributes"
            className="entity-panel entity-others"
            heading={text.otherAttributes}
            count={otherAttributes.length}
          >
            <AttributeList entity={entity} attributes={otherAttributes} />
          </PanelBlock>
        )}
        {headed.length > 0 && <TableOfContents sections={headed} heading={text.onThisPage} />}
        <MentionsPanel {...mentions} />
        <NeighbourhoodFold neighbours={neighbours} labels={given} open={mapOpen} />
      </div>
    </div>
  );
}
