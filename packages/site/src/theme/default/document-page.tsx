import type { JSX } from "preact";

import type {
  DocumentPageLabels,
  DocumentPageView,
  DocumentTwinFile,
  DocumentView,
  EntityPageProps,
  Section,
} from "../../slots.js";
import { useSlot } from "../context.js";
import { DocumentText, positionAnchor, ViewerIsland, viewerPropsOf } from "./document-viewer.js";
import { Breadcrumb, NeighbourhoodFold, PanelBlock } from "./entity-page.js";
import { SidePanel } from "./panel-handle.js";
import { PinButton } from "./pins.js";
import { labels } from "./labels.js";
import { SpaceTree } from "./space-tree.js";
import { Tabs } from "./tabs.js";

/** The labels of the default theme for every label the page does not receive; the file count is worded from the page. */
export function defaultDocumentPageLabels(files: number): DocumentPageLabels {
  return {
    document: labels.documentView,
    extractedText: labels.extractedText,
    relatedNotes: labels.relatedNotes,
    views: labels.documentViews,
    downloadOriginal: labels.downloadOriginal,
    pages: labels.pages,
    preview: labels.preview,
    openPdf: labels.openPdf,
    convertedNote: labels.convertedNote,
    originalNote: labels.originalNote,
    properties: labels.properties,
    type: labels.type,
    author: labels.author,
    pageCount: labels.pages,
    date: labels.date,
    dateNote: labels.dateNote,
    previewNote: labels.previewNote,
    sameDocument: `${labels.sameDocument}, ${String(files)} ${files === 1 ? labels.file : labels.filesUnit}`,
    groupedNote: labels.groupedNote,
    noNote: labels.noNote,
  };
}

/** The document the page centres on: the first one that is not a transcript. */
export function centralOf(documents: readonly DocumentView[]): DocumentView | undefined {
  return documents.find((document) => document.unit !== "cue");
}

/** The number of a page on its thumbnail, on two digits at least: `01`, `07`, `24`. */
export function pageNumber(number: number): string {
  return String(number).padStart(2, "0");
}

/** The strip of pages: one thumbnail per position, numbered, leading to the text of the position; the first one is the current one until the viewer runs. */
function PageStrip({
  document,
  heading,
}: {
  document: DocumentView;
  heading: string;
}): JSX.Element {
  return (
    <nav class="document-rail" aria-label={heading}>
      <span class="section-label" aria-hidden="true">
        {heading}
      </span>
      <ol>
        {document.positions.map((position) => (
          <li key={position.number}>
            <a
              href={`#${positionAnchor(position.number)}`}
              data-position={position.number}
              {...(position.number === 1 ? { class: "current", "aria-current": "true" } : {})}
            >
              <span class="document-number" aria-hidden="true">
                {pageNumber(position.number)}
              </span>
              <span class="visually-hidden">{position.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The PDF as the browser shows it, for a page without JavaScript or without the viewer; a browser that shows none gets the link. */
function EmbeddedPdf({
  href,
  text,
}: {
  href: string;
  text: Pick<DocumentPageLabels, "preview" | "openPdf">;
}): JSX.Element {
  return (
    <object class="document-embed" data={href} type="application/pdf" aria-label={text.preview}>
      <a class="document-pdf" href={href}>
        {text.openPdf}
      </a>
    </object>
  );
}

/**
 * The rendering of the current page: the viewer island opened as soon as its script runs when
 * the build produced the viewer; the PDF as the browser shows it otherwise, and behind a
 * `noscript` when the viewer exists so that the page never loads the PDF twice; under it the
 * two notes of the board.
 */
function Rendering({
  document,
  text,
}: {
  document: DocumentView;
  text: DocumentPageLabels;
}): JSX.Element {
  const viewer = viewerPropsOf(document);
  const preview = document.preview?.href;
  return (
    <div class="document-render">
      {viewer !== undefined && <ViewerIsland {...viewer} open />}
      {preview !== undefined &&
        (viewer === undefined ? (
          <EmbeddedPdf href={preview} text={text} />
        ) : (
          <noscript>
            <EmbeddedPdf href={preview} text={text} />
          </noscript>
        ))}
      <p class="document-render-note">
        <span>{text.convertedNote}</span>
        <span>{text.originalNote}</span>
      </p>
    </div>
  );
}

/** The note merged with the document, section by section with its legend; the tab says so when there is none. */
function Notes({ sections, text }: { sections: Section[]; text: DocumentPageLabels }): JSX.Element {
  return sections.length === 0 ? (
    <p class="empty">{text.noNote}</p>
  ) : (
    <article class="entity-body">
      {sections.map((section) => (
        <section key={section.id} id={section.id}>
          {section.heading !== undefined && <h2>{section.heading}</h2>}
          <div class="markdown" dangerouslySetInnerHTML={{ __html: section.html }} />
        </section>
      ))}
      <footer class="legend">
        <span class="legend-written">{labels.legendWritten}</span>
        <span class="legend-recognised">{labels.legendRecognised}</span>
        <span class="legend-keyword">{labels.legendKeyword}</span>
      </footer>
    </article>
  );
}

/** One row of the properties: the label, then the value or nothing when the corpus has none. */
function Property({
  label,
  value,
}: {
  label: string;
  value: JSX.Element | string | undefined;
}): JSX.Element {
  return (
    <div class="attribute">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** The files that make the document, one row each: its extension or name, then what it is. */
function TwinFiles({ files }: { files: DocumentTwinFile[] }): JSX.Element {
  return (
    <ul class="document-twins">
      {files.map((file) => (
        <li key={file.label}>
          {file.href === undefined ? (
            <span class="document-twin-name">{file.label}</span>
          ) : (
            <a class="document-twin-name" href={file.href}>
              {file.label}
            </a>
          )}
          <span class="document-twin-role">{file.role}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The page of an office document, a deck or a report: the tree of its space on the left, folded
 * by year and month when every page of the space is dated; in the centre the breadcrumb, the title,
 * the line naming the kind, the page count, the size and the date, then three views behind the
 * tabs of the theme: the document (the strip of pages, the rendering of the current page with
 * the viewer and its notes), the extracted text, the note merged with the document; the
 * download of the original at the end of the tab bar; then the path of the file with its edit
 * link. On the right the
 * properties read from the file, the files that make the document, the related pages, then the
 * neighbourhood folded behind its line.
 */
export function DocumentPage(props: EntityPageProps & { document: DocumentPageView }): JSX.Element {
  const { entity, space, breadcrumb = [], sections, sources, neighbours, mentions } = props;
  const document = centralOf(props.documents ?? []);
  const view = props.document;
  const MentionsPanel = useSlot("MentionsPanel");
  const text: DocumentPageLabels = {
    ...defaultDocumentPageLabels(view.files.length),
    ...view.labels,
  };
  const spaceTreeLabel = props.labels?.spaceTree ?? labels.spaceTree;
  const breadcrumbLabel = props.labels?.breadcrumb ?? labels.breadcrumb;
  return (
    <div
      class={
        space === undefined ? "entity document-page" : "entity entity-with-space document-page"
      }
    >
      {space !== undefined && <SpaceTree space={space} label={spaceTreeLabel} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={breadcrumbLabel} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <PinButton />
          <p class="entity-badge document-line">
            <span class="badge">{view.kind}</span>
            {view.pages !== undefined && (
              <span class="document-pages">
                {view.pagesLabel ?? `${String(view.pages)} ${labels.pages.toLowerCase()}`}
              </span>
            )}
            {view.size !== undefined && <span class="document-size">{view.size}</span>}
            {view.date !== undefined && (
              <time class="document-date" dateTime={view.date.date}>
                {view.date.label}
              </time>
            )}
          </p>
        </header>
        <Tabs
          label={text.views}
          className="document-views"
          tabs={[
            {
              id: "document-view",
              label: text.document,
              content:
                document === undefined ? (
                  <></>
                ) : (
                  <div class="document-stage">
                    {document.positions.length > 0 && (
                      <PageStrip document={document} heading={text.pages} />
                    )}
                    <Rendering document={document} text={text} />
                  </div>
                ),
            },
            {
              id: "document-text",
              label: text.extractedText,
              content: (
                <div class="document-text">
                  <DocumentText positions={document?.positions ?? []} index={1} />
                </div>
              ),
            },
            {
              id: "document-notes",
              label: text.relatedNotes,
              content: <Notes sections={sections} text={text} />,
            },
          ]}
          {...(document === undefined
            ? {}
            : {
                trailing: (
                  <a
                    class="document-download"
                    href={document.file.href}
                    download={document.file.label}
                  >
                    {text.downloadOriginal}
                  </a>
                ),
              })}
        />
        <footer class="entity-footer">
          {sources.map((source) => (
            <p key={source.path} class="entity-source">
              <code>
                {source.source}/{source.path}
              </code>
              {source.editHref !== undefined && (
                <span class="entity-edit-lead">
                  {props.labels?.correction ?? labels.correction}{" "}
                  <a class="entity-edit" href={source.editHref}>
                    {props.labels?.edit ?? labels.edit}
                  </a>
                </span>
              )}
            </p>
          ))}
        </footer>
      </div>
      <SidePanel>
        <PanelBlock id="entity-properties" className="entity-panel" heading={text.properties}>
          <dl class="attributes">
            <Property label={text.type} value={view.kind} />
            <Property label={text.author} value={view.author} />
            <Property
              label={text.pageCount}
              value={view.pages === undefined ? undefined : String(view.pages)}
            />
            <Property
              label={text.date}
              value={
                view.date === undefined ? undefined : (
                  <time dateTime={view.date.date}>{view.date.label}</time>
                )
              }
            />
          </dl>
          {view.date?.fromFile === true && <p class="panel-note">{text.dateNote}</p>}
          {view.fromPreview === true && <p class="panel-note">{text.previewNote}</p>}
        </PanelBlock>
        <PanelBlock
          id="document-files"
          className="entity-panel document-files"
          heading={text.sameDocument}
        >
          <TwinFiles files={view.files} />
          <p class="panel-note">{text.groupedNote}</p>
        </PanelBlock>
        <MentionsPanel {...mentions} />
        <NeighbourhoodFold neighbours={neighbours} labels={props.labels ?? {}} />
      </SidePanel>
    </div>
  );
}
