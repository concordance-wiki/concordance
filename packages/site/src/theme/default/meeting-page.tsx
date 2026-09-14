import { Fragment, type JSX } from "preact";

import type {
  DocumentView,
  EntityPageLabels,
  EntityPageProps,
  EntityRef,
  MeetingDecision,
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
import { SidePanel } from "./panel-handle.js";
import { labels } from "./labels.js";
import { SpaceTree } from "./space-tree.js";
import { Tabs, type Tab } from "./tabs.js";

/** The labels of the default theme, used for every label the page does not receive. */
export const defaultMeetingLabels: MeetingLabels = {
  representations: labels.representations,
  transcript: labels.transcript,
  notes: labels.notes,
  deck: labels.deck,
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

/** A timecode under the hour reads as minutes and seconds. */
export function cueTime(label: string): string {
  return label.replace(/^00:/, "");
}

/** The callout naming the decisions the meeting produced, each a link to its note. */
function DecisionNote({
  decisions,
  lead,
}: {
  decisions: MeetingDecision[];
  lead: string;
}): JSX.Element {
  return (
    <aside class="meeting-decision" role="note">
      <span class="meeting-decision-lead">{lead}</span>{" "}
      {decisions.map((decision, index) => (
        <Fragment key={decision.href}>
          {index > 0 && ", "}
          <a class="meeting-decision-link" href={decision.href}>
            {decision.label}
          </a>
        </Fragment>
      ))}
    </aside>
  );
}

/** One speaker turn: its timecode as an anchor, the speaker in bold, then what was said; under it the decisions that came out of this cue. */
function Cue({
  index,
  position,
  decisions,
  text,
}: {
  index: number;
  position: DocumentView["positions"][number];
  decisions: MeetingDecision[];
  text: MeetingLabels;
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
      {decisions.length > 0 && <DecisionNote decisions={decisions} lead={text.decision} />}
    </li>
  );
}

/**
 * The transcript as timestamped lines, the decisions the meeting produced in the cue each was
 * recognised in and, for the ones no cue names, at the head of the lines; the file to download
 * under them, then the note on the pseudonyms when they apply.
 */
function Transcript({
  document,
  index,
  decisions,
  pseudonymized,
  text,
}: {
  document: DocumentView;
  index: number;
  decisions: MeetingDecision[];
  pseudonymized: boolean;
  text: MeetingLabels;
}): JSX.Element {
  const cued = (position: DocumentView["positions"][number]): MeetingDecision[] =>
    decisions.filter((decision) => decision.cue === position.number);
  const uncued = decisions.filter(
    (decision) => !document.positions.some((position) => position.number === decision.cue),
  );
  return (
    <>
      {uncued.length > 0 && <DecisionNote decisions={uncued} lead={text.decision} />}
      {document.positions.length === 0 ? (
        <p class="empty">{labels.noExtractedText}</p>
      ) : (
        <ol class="transcript">
          {document.positions.map((position) => (
            <Cue
              key={position.number}
              index={index}
              position={position}
              decisions={cued(position)}
              text={text}
            />
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
        <span class="legend-keyword">{labels.legendKeyword}</span>
      </footer>
    </article>
  );
}

/** The id of a panel: the kind of its representation, the rank suffixed from the second one of a kind. */
function tabId(kind: string, rank: number): string {
  return rank === 1 ? `representation-${kind}` : `representation-${kind}-${String(rank)}`;
}

/**
 * The tabs of the page: the transcripts first, the decisions placed in the first one, then the
 * notes when the meeting has some, then the deck and any other converted document, its viewer
 * opening as soon as its tab is shown, each document keeping the anchors of its positions so
 * that a mention still lands on its cue, slide or page. A converted file and the PDF next to it
 * come as one document, so one tab.
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
    .map(({ document, index }, rank) => ({
      id: next("transcript"),
      label: text.transcript,
      content: (
        <Transcript
          document={document}
          index={index}
          decisions={rank === 0 ? meeting.decisions : []}
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
    const deck = document.unit === "slide";
    tabs.push({
      id: next(deck ? "deck" : "pages"),
      label: deck ? text.deck : text.document,
      content: <DocumentBlock document={document} index={index} open />,
    });
  }
  return tabs;
}

/**
 * The page of a meeting on the shell of the entity page: the same tree, breadcrumb and title;
 * under the title the type, the duration and the participants; then the representations as
 * tabs, the transcript as timestamped lines with the callout of the decisions the meeting produced in the
 * cue each came from, the notes as the entity page renders them, the deck with its viewer; the
 * callout after the tabs for a meeting without a transcript; the path of every file. In the
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
          <Tabs
            label={words.representations}
            tabs={tabs}
            className="meeting-representations"
            {...(meeting.grouping === undefined
              ? {}
              : { trailing: <span class="meeting-grouped">{words.grouped}</span> })}
          />
        )}
        {meeting.decisions.length > 0 && !documents.some((document) => document.unit === "cue") && (
          <div class="meeting-decisions">
            <DecisionNote decisions={meeting.decisions} lead={words.decision} />
          </div>
        )}
        <footer class="entity-footer">
          {sources.map((source) => (
            <Source key={source.path} source={source} text={text} />
          ))}
        </footer>
      </div>
      <SidePanel>
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
      </SidePanel>
    </div>
  );
}
