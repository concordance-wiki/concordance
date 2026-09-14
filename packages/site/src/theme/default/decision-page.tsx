import { Fragment, type JSX } from "preact";

import type {
  DecisionLabels,
  DecisionProps,
  DecisionSession,
  EntityPageLabels,
  EntityPageProps,
  Link,
} from "../../slots.js";
import { useSlot } from "../context.js";
import { DocumentBlock } from "./document-viewer.js";
import {
  Breadcrumb,
  defaultEntityPageLabels,
  NeighbourhoodFold,
  NoteSection,
  PanelBlock,
  Source,
} from "./entity-page.js";
import { fill } from "./mention-list.js";
import { SidePanel } from "./panel-handle.js";
import { PinButton } from "./pins.js";
import { SpaceTree } from "./space-tree.js";

/** The page of a decision: the same view model, the decision always there. */
export type DecisionPageProps = EntityPageProps & { decision: DecisionProps };

/** The placeholder of the link to the meeting in the sentences of the callout. */
const MINUTES = "{minutes}";

/** The English of the page, kept with its template: the islands bundle the shared labels of the theme, and the page has none. */
const english = {
  status: "Status",
  decidedOn: "Decided on",
  supersedes: "Supersedes",
  supersededBy: "Superseded by",
  session: "Session",
  key: "{count} key: the status and the date are authoritative.",
  keys: "{count} keys: the status and the date are authoritative.",
  sessionDated: "Decided in session on {date}.",
  sessionUndated: "Decided in session.",
  sessionPassage: "The exact passage is in {minutes}, at {time}.",
  sessionSee: "See {minutes}.",
  sessionMinutes: "the minutes",
  relatedNote:
    "A decision affects pages without being affected by them: its relations are almost all written.",
} as const;

/** The labels of the default theme, used for every label the page does not receive; the count of keys is worded from the page. */
export function defaultDecisionLabels(keys: number): DecisionLabels {
  const { key, keys: several, ...rest } = english;
  return { ...rest, keysNote: fill(keys === 1 ? key : several, { count: keys }) };
}

/** How many rows the properties block shows: the status, then each datum the view model carries. */
export function decisionKeyCount(decision: DecisionProps): number {
  return (
    1 +
    (decision.date === undefined ? 0 : 1) +
    (decision.supersedes === undefined ? 0 : 1) +
    (decision.supersededBy === undefined ? 0 : 1) +
    (decision.sessions.length === 0 ? 0 : 1)
  );
}

/** A sentence of the callout with the link to the meeting in place of its placeholder; the sentence as it is when it has none. */
function WithMinutes({
  sentence,
  href,
  words,
}: {
  sentence: string;
  href: string;
  words: string;
}): JSX.Element {
  const at = sentence.indexOf(MINUTES);
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <a class="decision-session-link" href={href}>
        {words}
      </a>
      {sentence.slice(at + MINUTES.length)}
    </>
  );
}

/**
 * The callout of one session the decision was taken in: the day of the session, then the
 * reference to its minutes, at the timecode of the cue that names the decision when a
 * transcript does; the reference leads to that cue, and never copies what was said.
 */
function SessionNote({
  session,
  text,
}: {
  session: DecisionSession;
  text: DecisionLabels;
}): JSX.Element {
  const lead =
    session.date === undefined
      ? text.sessionUndated
      : fill(text.sessionDated, { date: session.date });
  const passage =
    session.cue === undefined
      ? text.sessionSee
      : fill(text.sessionPassage, { time: session.cue.time });
  return (
    <aside class="decision-session" role="note">
      {lead}{" "}
      <WithMinutes
        sentence={passage}
        href={session.cue?.href ?? session.href}
        words={text.sessionMinutes}
      />
    </aside>
  );
}

/** One row of the properties block: its label, then a value in words or a link. */
function Row({ label, value }: { label: string; value: string | Link }): JSX.Element {
  return (
    <div class="attribute">
      <dt>{label}</dt>
      <dd>{typeof value === "string" ? value : <a href={value.href}>{value.label}</a>}</dd>
    </div>
  );
}

/**
 * The page of a decision on the shell of the entity page: the same tree, drawn by year when
 * every note of the space is dated, the breadcrumb naming the year, the title; under the title
 * one chip reading the type and the status, the identifier of the note and the day of the
 * decision; the note as written, its documents under it, then the callout of every session the
 * decision was taken in, pointing at the cue of the transcript that names it; the path of the
 * file at the foot, without the legend of the marks. In the panel the properties, the status
 * and the date first, then the decision it supersedes, the one that supersedes it and its
 * session, the note counting the keys; the related pages with the note that a decision cites
 * what it changes; the neighbourhood folded, or unfolded when `mapOpen` asks.
 */
export function DecisionPage({
  entity,
  typeHref,
  space,
  breadcrumb = [],
  sections,
  labels: given = {},
  neighbours,
  mentions,
  sources,
  documents = [],
  mapOpen = false,
  decision,
}: DecisionPageProps): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  const text: EntityPageLabels = {
    ...defaultEntityPageLabels(neighbours.total ?? neighbours.neighbours.length),
    ...given,
  };
  const words: DecisionLabels = {
    ...defaultDecisionLabels(decisionKeyCount(decision)),
    ...decision.labels,
  };
  return (
    <div class={space === undefined ? "entity decision" : "entity entity-with-space decision"}>
      {space !== undefined && <SpaceTree space={space} label={text.spaceTree} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <PinButton />
          <p class="entity-badge">
            <span class="badge decision-chip">
              {typeHref === undefined ? (
                entity.typeLabel
              ) : (
                <a class="decision-type" href={typeHref}>
                  {entity.typeLabel}
                </a>
              )}
              {" · "}
              <span class="decision-status">{decision.status.label}</span>
            </span>
            <code class="decision-id">{entity.id}</code>
            {decision.date !== undefined && (
              <time class="decision-date" dateTime={decision.date.date}>
                {decision.date.label}
              </time>
            )}
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
        {decision.sessions.map((session) => (
          <SessionNote key={session.href} session={session} text={words} />
        ))}
        <footer class="entity-footer">
          {sources.map((source) => (
            <Source key={source.path} source={source} text={text} />
          ))}
        </footer>
      </div>
      <SidePanel>
        <PanelBlock
          id="decision-properties"
          className="entity-panel decision-properties"
          heading={text.properties}
        >
          <dl class="attributes">
            <Row label={words.status} value={decision.status.label} />
            {decision.date !== undefined && (
              <div class="attribute">
                <dt>{words.decidedOn}</dt>
                <dd>
                  <time dateTime={decision.date.date}>{decision.date.label}</time>
                </dd>
              </div>
            )}
            {decision.supersedes !== undefined && (
              <Row label={words.supersedes} value={decision.supersedes} />
            )}
            {decision.supersededBy !== undefined && (
              <Row label={words.supersededBy} value={decision.supersededBy} />
            )}
            {decision.sessions.length > 0 && (
              <div class="attribute">
                <dt>{words.session}</dt>
                <dd>
                  {decision.sessions.map((session, index) => (
                    <Fragment key={session.href}>
                      {index > 0 && ", "}
                      <a href={session.href}>{session.label}</a>
                    </Fragment>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <p class="panel-note">{words.keysNote}</p>
        </PanelBlock>
        <MentionsPanel
          {...mentions}
          labels={{ ...mentions.labels, orderNote: words.relatedNote }}
        />
        <NeighbourhoodFold neighbours={neighbours} labels={given} open={mapOpen} />
      </SidePanel>
    </div>
  );
}
