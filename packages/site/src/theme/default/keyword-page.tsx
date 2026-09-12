import type { JSX } from "preact";

import type { KeywordPageProps } from "../../slots.js";
import { labels } from "./labels.js";

export function KeywordPage({
  entity,
  counts,
  passages,
  companions,
  similar,
}: KeywordPageProps): JSX.Element {
  return (
    <article class="keyword">
      <header class="entity-header">
        <p class="entity-badge">
          <span class="badge">{labels.keyword}</span>
        </p>
        <h1>{entity.title}</h1>
        <p class="banner" role="note">
          {labels.noNote}: {counts.occurrences} {labels.passagesRecorded}.
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
      </header>
      <section class="passages" aria-labelledby="passages-title">
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
                  </a>
                  <q>{passage.context}</q>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      <section class="companions" aria-labelledby="companions-title">
        <h2 id="companions-title">{labels.companions}</h2>
        <ul>
          {companions.map((companion) => (
            <li key={companion.label} class="companion" data-weight={companion.weight}>
              {companion.href === undefined ? (
                <span>{companion.label}</span>
              ) : (
                <a href={companion.href}>{companion.label}</a>
              )}
            </li>
          ))}
        </ul>
      </section>
      {similar.length > 0 && (
        <section class="similar" aria-labelledby="similar-title">
          <h2 id="similar-title">{labels.similar}</h2>
          <p>{labels.similarLead}</p>
          <ul>
            {similar.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
