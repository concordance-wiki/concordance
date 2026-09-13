import { Fragment, type JSX } from "preact";

import type {
  DocumentView,
  EntityPageLabels,
  EntityPageProps,
  EntityRef,
  MeetingLabels,
  MeetingProps,
  Section,
} from "../../slots.js";
import { useSlot } from "../context.js";
import { DocumentBlock, positionAnchor } from "./document-viewer.js";
import {
  Breadcrumb,
  defaultEntityPageLabels,
  NeighbourhoodFold,
  NoteSection,
  PanelBlock,
  Source,
} from "./entity-page.js";
import { labels } from "./labels.js";
import { SpaceTree } from "./space-tree.js";

/** The labels of the default theme, used for every label the page does not receive. */
export const defaultMeetingLabels: MeetingLabels = {
  representations: labels.representations,
  transcript: labels.transcript,
  notes: labels.notes,
  slides: labels.slides,
  document: labels.document,
  grouped: labels.groupedAutomatically,
  decision: labels.decisionTakenHere,
  pseudonymNote: labels.pseudonymNote,
  date: labels.date,
  duration: labels.duration,
  space: labels.space,
  files: labels.filesCount,
  relatedNote: labels.meetingRelatedNote,
};

/** How many tabs the stylesheet marks as current by their position; a page rarely has more than three. */
export const TABS_MARKED = 4;

/** One representation of the meeting as a tab: the transcript, the notes or a converted document. */
interface Tab {
  /** The id of the panel, the target of the tab: `representation-transcript`. */
  id: string;
  label: string;
  content: JSX.Element;
}

/** A timecode under the hour reads as minutes and seconds. */
export function cueTime(label: string): string {
  return label.replace(/^00:/, "");
}

/** One speaker turn: its timecode as an anchor, the speaker in bold, then what was said. */
function Cue({
  index,
  position,
}: {
  index: number;
  position: DocumentView["positions"][number];
}): JSX.Element {
  const anchor = positionAnchor(position.number, index);
  return (
    <li class="cue" id={anchor}>
      <a class="cue-time" href={`#${anchor}`}>
        {cueTime(position.label)}
      </a>
      <p class="cue-text">
        {position.speaker !== undefined && (
          <>
            <b class="cue-speaker">{position.speaker}</b>
            {" — "}
          </>
        )}
        {position.text}
      </p>
    </li>
  );
}

/** The transcript as timestamped lines, the file to download under them, then the note on the pseudonyms when they apply. */
function Transcript({
  document,
  index,
  pseudonymized,
  text,
}: {
  document: DocumentView;
  index: number;
  pseudonymized: boolean;
  text: MeetingLabels;
}): JSX.Element {
  return (
    <>
      {document.positions.length === 0 ? (
        <p class="empty">{labels.noExtractedText}</p>
      ) : (
        <ol class="transcript">
          {document.positions.map((position) => (
            <Cue key={position.number} index={index} position={position} />
          ))}
        </ol>
      )}
      <p class="document-files">
        <a class="document-download" href={document.file.href} download={document.file.label}>
          {labels.download} {document.file.label}
        </a>
      </p>
      {pseudonymized && <p class="meeting-pseudonyms">{text.pseudonymNote}</p>}
    </>
  );
}

/** The written notes, as the entity page renders them. */
function Notes({ entity, sections }: { entity: EntityRef; sections: Section[] }): JSX.Element {
  return (
    <article class="entity-body">
      {sections.map((section) => (
        <NoteSection
          key={section.id}
          entity={entity}
          section={section}
          imageNote={labels.imageNote}
        />
      ))}
      <footer class="legend">
        <span class="legend-written">{labels.legendWritten}</span>
        <span class="legend-recognised">{labels.legendRecognised}</span>
      </footer>
    </article>
  );
}

/** The id of a panel: the kind of its representation, the rank suffixed from the second one of a kind. */
function tabId(kind: string, rank: number): string {
  return rank === 1 ? `representation-${kind}` : `representation-${kind}-${String(rank)}`;
}

/**
 * The tabs of the page, one per representation: the transcripts first, then the notes when
 * the meeting has some, then the decks and the other converted documents, each document keeping
 * the anchors of its positions so that a mention still lands on its cue, slide or page.
 */
function tabsOf(
  entity: EntityRef,
  sections: Section[],
  documents: DocumentView[],
  meeting: MeetingProps,
  text: MeetingLabels,
): Tab[] {
  const ranks = new Map<string, number>();
  const next = (kind: string): string => {
    const rank = (ranks.get(kind) ?? 0) + 1;
    ranks.set(kind, rank);
    return tabId(kind, rank);
  };
  const indexed = documents.map((document, position) => ({ document, index: position + 1 }));
  const tabs: Tab[] = indexed
    .filter(({ document }) => document.unit === "cue")
    .map(({ document, index }) => ({
      id: next("transcript"),
      label: text.transcript,
      content: (
        <Transcript
          document={document}
          index={index}
          pseudonymized={meeting.pseudonymized}
          text={text}
        />
      ),
    }));
  if (sections.length > 0) {
    tabs.push({
      id: next("notes"),
      label: text.notes,
      content: <Notes entity={entity} sections={sections} />,
    });
  }
  for (const { document, index } of indexed) {
    if (document.unit === "cue") continue;
    const kind = document.unit === "slide" ? "slides" : "pages";
    tabs.push({
      id: next(kind),
      label: document.unit === "slide" ? text.slides : text.document,
      content: <DocumentBlock document={document} index={index} />,
    });
  }
  return tabs;
}

/**
 * The page of a meeting on the shell of the entity page: the same tree, breadcrumb and title;
 * under the title the type, the duration and the participants; then the representations as
 * tabs, anchors to panels that the stylesheet shows one at a time and without any script, the
 * transcript as timestamped lines, the notes as the entity page renders them, a deck with its
 * viewer; the callout of the decisions the meeting produced; the path of every file. In the
 * panel the properties, the related pages and the neighbourhood folded, or unfolded when
 * `mapOpen` asks, as on every entity page.
 */
export function MeetingPage({
  entity,
  space,
  breadcrumb = [],
  sections,
  labels: given = {},
  neighbours,
  mentions,
  sources,
  documents = [],
  mapOpen = false,
  meeting,
}: EntityPageProps & { meeting: MeetingProps }): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  const text: EntityPageLabels = {
    ...defaultEntityPageLabels(neighbours.total ?? neighbours.neighbours.length),
    ...given,
  };
  const words: MeetingLabels = { ...defaultMeetingLabels, ...meeting.labels };
  const tabs = tabsOf(entity, sections, documents, meeting, words);
  const spaceHref = breadcrumb[0]?.href;
  return (
    <div class={space === undefined ? "entity meeting" : "entity entity-with-space meeting"}>
      {space !== undefined && <SpaceTree space={space} label={text.spaceTree} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <p class="entity-badge">
            <span class="badge">{entity.typeLabel}</span>
            {meeting.duration !== undefined && (
              <span class="meeting-duration">{meeting.duration}</span>
            )}
            {meeting.participants !== undefined && (
              <span class="meeting-participants">{meeting.participants}</span>
            )}
          </p>
        </header>
        {tabs.length > 0 && (
          <div class="meeting-representations">
            <nav class="meeting-tabs" aria-label={words.representations}>
              {tabs.map((tab) => (
                <a key={tab.id} class="meeting-tab" id={`tab-${tab.id}`} href={`#${tab.id}`}>
                  {tab.label}
                </a>
              ))}
              {meeting.grouping !== undefined && (
                <span class="meeting-grouped">{words.grouped}</span>
              )}
            </nav>
            <div class="meeting-panels">
              {tabs.map((tab) => (
                <section
                  key={tab.id}
                  class="meeting-panel"
                  id={tab.id}
                  aria-labelledby={`tab-${tab.id}`}
                >
                  {tab.content}
                </section>
              ))}
            </div>
          </div>
        )}
        {meeting.decisions.length > 0 && (
          <div class="meeting-decisions">
            <aside class="meeting-decision" role="note">
              <span class="meeting-decision-lead">{words.decision}</span>{" "}
              {meeting.decisions.map((decision, index) => (
                <Fragment key={decision.href}>
                  {index > 0 && ", "}
                  <a class="meeting-decision-link" href={decision.href}>
                    {decision.label}
                  </a>
                </Fragment>
              ))}
            </aside>
          </div>
        )}
        <footer class="entity-footer">
          {sources.map((source) => (
            <Source key={source.path} source={source} text={text} />
          ))}
        </footer>
      </div>
      <div class="entity-side">
        <PanelBlock
          id="meeting-properties"
          className="entity-panel meeting-properties"
          heading={text.properties}
        >
          <dl class="attributes">
            {meeting.date !== undefined && (
              <div class="attribute">
                <dt>{words.date}</dt>
                <dd>
                  <time dateTime={meeting.date.date}>{meeting.date.label}</time>
                </dd>
              </div>
            )}
            {meeting.duration !== undefined && (
              <div class="attribute">
                <dt>{words.duration}</dt>
                <dd>{meeting.duration}</dd>
              </div>
            )}
            {space !== undefined && (
              <div class="attribute">
                <dt>{words.space}</dt>
                <dd>
                  {spaceHref === undefined ? space.name : <a href={spaceHref}>{space.name}</a>}
                </dd>
              </div>
            )}
            {meeting.grouping !== undefined && (
              <div class="attribute">
                <dt>{words.files}</dt>
                <dd>{meeting.grouping.label}</dd>
              </div>
            )}
          </dl>
          {meeting.grouping?.note !== undefined && (
            <p class="panel-note">{meeting.grouping.note}</p>
          )}
        </PanelBlock>
        <MentionsPanel {...mentions} />
        <NeighbourhoodFold neighbours={neighbours} labels={given} open={mapOpen} />
      </div>
    </div>
  );
}
