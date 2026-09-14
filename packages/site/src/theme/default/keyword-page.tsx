import type { ComponentChildren, JSX } from "preact";

import type { KeywordPageLabels, KeywordPageProps, Passage, PassageGroup } from "../../slots.js";
import { useSlot } from "../context.js";
import { Breadcrumb, NeighbourhoodFold, PanelBlock } from "./entity-page.js";
import { SidePanel } from "./panel-handle.js";
import { labels } from "./labels.js";
import { SpaceTree } from "./space-tree.js";

/** The labels of the default theme, used for every label the page does not receive; the neighbour count is worded from the page. */
export function defaultKeywordPageLabels(neighbours: number): KeywordPageLabels {
  return {
    spaceTree: labels.spaceTree,
    breadcrumb: labels.breadcrumb,
    noDefinition: labels.noDefinition,
    passages: labels.passages,
    whatWeKnow: labels.whatWeKnow,
    occurrences: labels.occurrences,
    files: labels.filesCount,
    spaces: labels.spaces,
    noProperty: labels.noProperty,
    maybeSame: labels.maybeSame,
    seeNeighbourhood: labels.seeNeighbourhood,
    neighbourPages: `${String(neighbours)} ${labels.neighbourPages}`,
  };
}

/** The context of a passage, the expression marked where it is found as written; the text alone otherwise. */
export function markedContext(passage: Passage): ComponentChildren {
  const { context, text } = passage;
  if (text === undefined || text === "") return context;
  const at = context.indexOf(text);
  if (at === -1) return context;
  return (
    <>
      {context.slice(0, at)}
      <mark>{context.slice(at, at + text.length)}</mark>
      {context.slice(at + text.length)}
    </>
  );
}

/** The rows of passages: where each one stands, and its text with the expression marked. */
function PassageRows({ passages }: { passages: readonly Passage[] }): JSX.Element {
  return (
    <ul class="passage-list">
      {passages.map((passage) => (
        <li key={passage.href} class="passage">
          <a class="passage-at" href={passage.href}>
            {passage.location ?? `${labels.line} ${String(passage.line)}`}
          </a>
          <q class="passage-text">{markedContext(passage)}</q>
        </li>
      ))}
    </ul>
  );
}

/**
 * One page: its type, its title linking to it, its number of passages, then the passages in
 * view, and the others behind a fold worded with their count when the page builder folded them.
 */
function PassageFile({ group }: { group: PassageGroup }): JSX.Element {
  const folded = group.folded;
  const count = group.passages.length + (folded?.passages.length ?? 0);
  return (
    <section class="passage-group">
      <h3 class="passage-file">
        {group.typeLabel !== undefined && <span class="badge">{group.typeLabel}</span>}
        <a class="passage-title" href={group.file.href}>
          {group.title ?? group.file.label}
        </a>
        <span class="passage-count">{count}</span>
      </h3>
      <PassageRows passages={group.passages} />
      {folded !== undefined && (
        <details class="passage-more">
          <summary>{folded.label}</summary>
          <PassageRows passages={folded.passages} />
        </details>
      )}
    </section>
  );
}

/**
 * The page of a word nobody defined, on the shell of the entity page: the tree of the space the
 * word is filed in on the left; in the centre the breadcrumb, the title marked as having no note,
 * the line saying so and since when the word is used, then in place of the note the notice with
 * the lead to propose a definition, and the passages grouped by page, each page with its type,
 * its title and its count, two passages in view and the others folded under their count, the
 * pages beyond the first six behind a disclosure; on the right the
 * counts under "what we know" with the note that the word has no property, the expressions of a
 * similar form as a lead, the related pages, and the neighbourhood folded behind its line,
 * drawn from the words that accompany the word, through the slots of the theme. No article, no
 * properties, no source footer: a keyword page has no file of its own.
 */
export function KeywordPage({
  entity,
  space,
  breadcrumb = [],
  usedSince,
  banner,
  counts,
  spaces,
  summary,
  passages,
  morePassages,
  similar,
  similarLead,
  neighbours,
  mentions,
  labels: given = {},
}: KeywordPageProps): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  const text: KeywordPageLabels = {
    ...defaultKeywordPageLabels(neighbours.neighbours.length),
    ...given,
  };
  return (
    <div class={space === undefined ? "entity keyword" : "entity entity-with-space keyword"}>
      {space !== undefined && <SpaceTree space={space} label={text.spaceTree} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1 class="keyword-title">{entity.title}</h1>
          <p class="entity-badge">
            <span class="badge badge-noteless">{text.noDefinition}</span>
            {usedSince !== undefined && (
              <time class="keyword-since" dateTime={usedSince.date}>
                {usedSince.label}
              </time>
            )}
          </p>
        </header>
        <aside class="keyword-notice" role="note">
          <p class="keyword-notice-lead">{banner.text}</p>
          {banner.detail !== undefined && <p class="keyword-notice-detail">{banner.detail}</p>}
          {banner.createNote.href !== undefined && (
            <a class="create-note" href={banner.createNote.href}>
              {banner.createNote.label}
            </a>
          )}
        </aside>
        <section class="keyword-body" aria-labelledby="passages-title">
          <h2 id="passages-title">{text.passages}</h2>
          <p class="keyword-summary">{summary}</p>
          {passages.map((group) => (
            <PassageFile key={group.file.href} group={group} />
          ))}
          {morePassages !== undefined && (
            <details class="passage-files-more">
              <summary>{morePassages.label}</summary>
              {morePassages.groups.map((group) => (
                <PassageFile key={group.file.href} group={group} />
              ))}
            </details>
          )}
        </section>
      </div>
      <SidePanel>
        <PanelBlock id="keyword-facts" className="keyword-facts" heading={text.whatWeKnow}>
          <dl class="attributes">
            <div class="attribute">
              <dt>{text.occurrences}</dt>
              <dd>{counts.occurrences}</dd>
            </div>
            <div class="attribute">
              <dt>{text.files}</dt>
              <dd>{counts.files}</dd>
            </div>
            <div class="attribute">
              <dt>{text.spaces}</dt>
              <dd>{spaces.length === 0 ? counts.sources : spaces.join(", ")}</dd>
            </div>
          </dl>
          <p class="panel-note">{text.noProperty}</p>
        </PanelBlock>
        {similar.length > 0 && (
          <PanelBlock id="keyword-similar" className="keyword-similar" heading={text.maybeSame}>
            <ul class="similar-list">
              {similar.map((lead) => (
                <li key={lead.href}>
                  <a class="similar-lead" href={lead.href}>
                    <span class="similar-label">
                      {lead.label}
                      {lead.aliases !== undefined && (
                        <span class="similar-aliases">{lead.aliases.join(", ")}</span>
                      )}
                    </span>
                    <span class="similar-count">{lead.count}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p class="panel-note">{similarLead}</p>
          </PanelBlock>
        )}
        <MentionsPanel {...mentions} />
        <NeighbourhoodFold neighbours={neighbours} labels={given} />
      </SidePanel>
    </div>
  );
}
