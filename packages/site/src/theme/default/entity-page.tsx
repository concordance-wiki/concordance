import type { JSX } from "preact";

import type { EntityPageProps } from "../../slots.js";
import { useSlot } from "../context.js";
import { AttributeList, Value } from "./attributes.js";
import { labels } from "./labels.js";

const HIGHLIGHTS_MAX = 5;

export function EntityPage({
  entity,
  highlights,
  sections,
  attributes,
  neighbours,
  mentions,
  sources,
}: EntityPageProps): JSX.Element {
  const Neighbourhood = useSlot("Neighbourhood");
  const MentionsPanel = useSlot("MentionsPanel");
  return (
    <article class="entity">
      <header class="entity-header">
        <p class="entity-badge">
          <span class="badge">{entity.typeLabel}</span>
          {highlights.slice(0, HIGHLIGHTS_MAX).map((attribute) => (
            <span key={attribute.name} class="highlight">
              <span class="highlight-label">{attribute.label}</span>{" "}
              {attribute.values.map((value, index) => (
                <Value key={index} value={value} />
              ))}
            </span>
          ))}
        </p>
        <h1>{entity.title}</h1>
      </header>
      <div class="entity-body">
        {sections.map((section) => (
          <section key={section.id} id={section.id}>
            {section.heading !== undefined && <h2>{section.heading}</h2>}
            <div class="markdown" dangerouslySetInnerHTML={{ __html: section.html }} />
          </section>
        ))}
        <p class="legend">
          <span class="legend-written">{labels.legendWritten}</span>
          <span class="legend-recognised">{labels.legendRecognised}</span>
        </p>
      </div>
      {attributes.length > 0 && (
        <aside class="entity-panel" aria-labelledby="entity-properties">
          <h2 id="entity-properties">{labels.properties}</h2>
          <AttributeList attributes={attributes} />
        </aside>
      )}
      <Neighbourhood {...neighbours} />
      <MentionsPanel {...mentions} />
      <footer class="entity-footer">
        {sources.map((source) => (
          <p key={source.path} class="entity-source">
            <code>{source.path}</code>
            {source.editHref !== undefined && (
              <a class="entity-edit" href={source.editHref}>
                {labels.editInForge}
              </a>
            )}
          </p>
        ))}
      </footer>
    </article>
  );
}
