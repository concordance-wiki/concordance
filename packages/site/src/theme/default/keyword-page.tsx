import type { ComponentChildren, JSX } from "preact";

import type { KeywordPageProps, Passage } from "../../slots.js";
import { useSlot } from "../context.js";
import { NeighbourhoodFold } from "./entity-page.js";
import { labels } from "./labels.js";

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

/**
 * The page of a word nobody defined, on the shell of the entity page: the title, the badge and
 * the "no note" mark, then in place of the note a banner saying so with the number of passages,
 * the three counts and the passages grouped by file; in the right panel the accompanying words
 * and the similar expressions where the entity page keeps its properties, the related pages,
 * and the neighbourhood folded behind its line, through the slots of the theme. No article, no
 * properties, no source footer: a keyword page has no file of its own.
 */
export function KeywordPage({
  entity,
  banner,
  counts,
  passages,
  companions,
  similar,
  similarLead,
  neighbours,
  mentions,
  labels: given = {},
}: KeywordPageProps): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  return (
    <div class="entity keyword">
      <div class="entity-main">
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <p class="entity-badge">
            <span class="badge">{entity.typeLabel}</span>
            <span class="noteless">{labels.noteless}</span>
          </p>
        </header>
        <section class="keyword-body" aria-labelledby="passages-title">
          <p class="banner" role="note">
            {banner.text}{" "}
            {banner.createNote.href === undefined ? (
              <span class="create-note">{banner.createNote.label}</span>
            ) : (
              <a class="create-note" href={banner.createNote.href}>
                {banner.createNote.label}
              </a>
            )}
          </p>
          <dl class="counts">
            <div>
              <dt>{labels.occurrences}</dt>
              <dd>{counts.occurrences}</dd>
            </div>
            <div>
              <dt>{labels.filesCount}</dt>
              <dd>{counts.files}</dd>
            </div>
            <div>
              <dt>{labels.sourcesCount}</dt>
              <dd>{counts.sources}</dd>
            </div>
          </dl>
          <h2 id="passages-title">{labels.passages}</h2>
          {passages.map((group) => (
            <section key={group.file.href} class="passage-group">
              <h3>
                <a href={group.file.href}>{group.file.label}</a>
              </h3>
              <ul>
                {group.passages.map((passage) => (
                  <li key={passage.href}>
                    <a href={passage.href}>
                      {labels.line} {passage.line}
                    </a>{" "}
                    <q>{markedContext(passage)}</q>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      </div>
      <div class="entity-side">
        <aside class="keyword-panel panel-block" aria-labelledby="companions-title">
          <h2 id="companions-title">{labels.companions}</h2>
          {companions.length === 0 ? (
            <p class="empty">{labels.noCompanion}</p>
          ) : (
            <ul class="companions">
              {companions.map((companion) => (
                <li key={companion.label} class="companion" data-weight={companion.weight}>
                  {companion.href === undefined ? (
                    <span>{companion.label}</span>
                  ) : (
                    <a href={companion.href}>{companion.label}</a>
                  )}{" "}
                  <span class="count">{companion.count}</span>
                </li>
              ))}
            </ul>
          )}
          {similar.length > 0 && (
            <section class="similar" aria-labelledby="similar-title">
              <h2 id="similar-title">{labels.similar}</h2>
              <p>{similarLead}</p>
              <ul>
                {similar.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
        <MentionsPanel {...mentions} />
        <NeighbourhoodFold neighbours={neighbours} labels={given} />
      </div>
    </div>
  );
}
