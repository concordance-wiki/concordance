import type { JSX } from "preact";

import type {
  BreadcrumbItem,
  EntityPageLabels,
  EntityPageProps,
  EntityRef,
  FoldablePanel,
  NeighbourhoodProps,
  Section,
  SourceRef,
  SpaceTree as SpaceTreeModel,
} from "../../slots.js";
import { withImageNotes } from "../../markdown/figures.js";
import { useSectionPart, useSlot } from "../context.js";
import { AttributeList } from "./attributes.js";
import { DocumentBlock } from "./document-viewer.js";
import { labels } from "./labels.js";
import { fill } from "./mention-list.js";
import { NeighbourhoodIcon } from "./neighbourhood.js";
import { PanelBlock } from "./panel-block.js";
import { SidePanel } from "./panel-handle.js";
import { PinButton } from "./pins.js";
import { SpaceTree } from "./space-tree.js";
import { TableOfContents } from "./toc.js";

export { PanelBlock } from "./panel-block.js";

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
    editShort: labels.editShort,
  };
}

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

/** The space of the page on the line under the title, "Space Specifications", leading to the page of the space when the tree knows it. */
export function SpaceMark({ space, label }: { space: SpaceTreeModel; label: string }): JSX.Element {
  return space.href === undefined ? (
    <span class="entity-space">{label}</span>
  ) : (
    <a class="entity-space" href={space.href}>
      {label}
    </a>
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

/** The classes of the layout of a page: its left column when it has a space, and the panels served folded. */
export function entityClasses(
  withSpace: boolean,
  folded: readonly FoldablePanel[],
  ...more: string[]
): string {
  return [
    "entity",
    ...(withSpace ? ["entity-with-space"] : []),
    ...folded.map((panel) => `entity-${panel}-folded`),
    ...more,
  ].join(" ");
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
 * The path of the file in the monospace family, linked to the file on its forge when known,
 * then the call to action when it has somewhere to lead. Under the phone width the stylesheet
 * keeps the name of the file alone, its folders left out, and the short label of the link, so
 * that the foot reads "plafond.md · Edit" on one line.
 */
export function Source({
  source,
  text,
}: {
  source: SourceRef;
  text: EntityPageLabels;
}): JSX.Element {
  const cut = source.path.lastIndexOf("/") + 1;
  const path = (
    <code>
      <span class="entity-source-folders">
        {source.source}/{source.path.slice(0, cut)}
      </span>
      {source.path.slice(cut)}
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
          <span class="entity-edit-question">{text.correction}</span>{" "}
          <a class="entity-edit" href={source.editHref}>
            <span class="entity-edit-long">{text.edit}</span>
            <span class="entity-edit-short">{text.editShort}</span>
          </a>
        </span>
      )}
    </p>
  );
}

/**
 * The neighbourhood folded behind its line at the foot of the panel, a decorative mark before
 * the lead and the number of pages the map draws worded after it, then as a bare count for the
 * phone, where the line reads as the other folded sections. Open, the summary turns into
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
        <span class="count panel-count neighbourhood-number">{neighbours.neighbours.length}</span>
        <span class="neighbourhood-head">{neighbours.labels?.map ?? labels.neighbourhoodMap}</span>
        <span class="neighbourhood-page">{neighbours.centre}</span>
      </summary>
      <Neighbourhood {...neighbours} />
    </details>
  );
}

/**
 * The page of every typed entity, whatever its type: the tree of its space on the left; in the
 * centre the breadcrumb, the title, the line naming the type, the last change and the space,
 * the note at full column width, its documents under it, then the foot of the article, the
 * legend of the marks of the text with the path of the file and its edit link; on the right
 * three stacked blocks, the declared attributes (and the attributes the type does not declare,
 * when the note sets some), the table of contents of the note, the related pages, then the
 * neighbourhood folded behind its line. The properties the profile puts forward stay in the
 * panel with the others: the line under the title names nothing the panel says. An attribute
 * value or a mapped section goes through the `Attribute@<name>` or `Section@<key>` component
 * of the theme or of the type module when one exists; the rest of the page is the same for
 * every type. `mapOpen` serves the neighbourhood unfolded, as the reader sees it after opening
 * its line. An API whose contract was imported has a page of its own, `ApiPage`, which the
 * theme serves in its place; the default theme hands a meeting, whose view model carries what
 * its files bring, to the meeting template on the same shell, and an entity the build laid out
 * as a document page, an office document with what the page says of it, to the document
 * template.
 */
export function EntityPage({
  entity,
  typeHref,
  space,
  breadcrumb = [],
  changed,
  sections,
  attributes,
  otherAttributes = [],
  labels: given = {},
  neighbours,
  mentions,
  sources,
  documents = [],
  mapOpen = false,
  folded = [],
  pinned = false,
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
  const headed = sections.filter((section) => section.heading !== undefined);
  return (
    <div class={entityClasses(space !== undefined, folded)}>
      {space !== undefined && (
        <SpaceTree space={space} label={text.spaceTree} folded={folded.includes("tree")} />
      )}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <PinButton pinned={pinned} />
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
          </p>
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
      <SidePanel folded={folded.includes("panel")}>
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
      </SidePanel>
    </div>
  );
}
