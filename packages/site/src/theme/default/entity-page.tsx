import type { JSX } from "preact";

import type { Attribute, EntityPageProps, EntityRef, Section } from "../../slots.js";
import { useSectionPart, useSlot } from "../context.js";
import { AttributeList, AttributeValues } from "./attributes.js";
import { ContractSection } from "./contract-section.js";
import { DocumentBlock } from "./document-viewer.js";
import { labels } from "./labels.js";

/** How many highlights sit on the badge line; the next ones go on a line of their own. */
export const HIGHLIGHTS_WITH_BADGE = 2;
/** How many highlights the header shows in all; the rest stays in the panel. */
export const HIGHLIGHTS_MAX = 5;

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

function PlainSection({ section }: { section: Section }): JSX.Element {
  return (
    <section id={section.id}>
      {section.heading !== undefined && <h2>{section.heading}</h2>}
      <div class="markdown" dangerouslySetInnerHTML={{ __html: section.html }} />
    </section>
  );
}

/** A mapped section of the note, through the `Section@<key>` component of the theme or of the type module when one exists. */
function MappedSection({
  entity,
  section,
  sectionKey,
}: {
  entity: EntityRef;
  section: Section;
  sectionKey: string;
}): JSX.Element {
  const Part = useSectionPart(entity.type, sectionKey);
  return Part === undefined ? (
    <PlainSection section={section} />
  ) : (
    <Part entity={entity} section={section} />
  );
}

function NoteSection({ entity, section }: { entity: EntityRef; section: Section }): JSX.Element {
  return section.key === undefined ? (
    <PlainSection section={section} />
  ) : (
    <MappedSection entity={entity} section={section} sectionKey={section.key} />
  );
}

/**
 * The page of every typed entity, whatever its type: the badge and the highlights, the title,
 * the note at full column width, its documents under it, the contract of an API after it, then
 * the side panel of declared attributes, the attributes the type does not declare, the
 * neighbourhood, the mentions and the sources. An attribute value or a mapped section goes
 * through the `Attribute@<name>` or `Section@<key>` component of the theme or of the type
 * module when one exists; the rest of the page is the same for every type.
 */
export function EntityPage({
  entity,
  highlights,
  sections,
  attributes,
  otherAttributes = [],
  labels: given = {},
  neighbours,
  mentions,
  sources,
  contract,
  documents = [],
}: EntityPageProps): JSX.Element {
  const Neighbourhood = useSlot("Neighbourhood");
  const MentionsPanel = useSlot("MentionsPanel");
  const withBadge = highlights.slice(0, HIGHLIGHTS_WITH_BADGE);
  const underBadge = highlights.slice(HIGHLIGHTS_WITH_BADGE, HIGHLIGHTS_MAX);
  return (
    <div class="entity">
      <header class="entity-header">
        <p class="entity-badge">
          <span class="badge">{entity.typeLabel}</span>
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
        <h1>{entity.title}</h1>
      </header>
      <article class="entity-body">
        {sections.map((section) => (
          <NoteSection key={section.id} entity={entity} section={section} />
        ))}
        {sections.length > 0 && (
          <footer class="legend">
            <span class="legend-written">{labels.legendWritten}</span>
            <span class="legend-recognised">{labels.legendRecognised}</span>
          </footer>
        )}
        {documents.map((document, index) => (
          <DocumentBlock key={document.file.href} document={document} index={index + 1} />
        ))}
      </article>
      {contract !== undefined && <ContractSection {...contract} />}
      {attributes.length > 0 && (
        <aside class="entity-panel" aria-labelledby="entity-properties">
          <h2 id="entity-properties">{given.properties ?? labels.properties}</h2>
          <AttributeList entity={entity} attributes={attributes} />
        </aside>
      )}
      {otherAttributes.length > 0 && (
        <aside class="entity-panel entity-others" aria-labelledby="entity-other-attributes">
          <h2 id="entity-other-attributes">{given.otherAttributes ?? labels.otherAttributes}</h2>
          <AttributeList entity={entity} attributes={otherAttributes} />
        </aside>
      )}
      <Neighbourhood {...neighbours} />
      <MentionsPanel {...mentions} />
      <footer class="entity-footer">
        {sources.map((source) => (
          <p key={source.path} class="entity-source">
            {labels.source}{" "}
            <code>
              {source.source}/{source.path}
            </code>
            {source.editHref !== undefined && (
              <a class="entity-edit" href={source.editHref}>
                {labels.editInForge}
              </a>
            )}
          </p>
        ))}
      </footer>
    </div>
  );
}
