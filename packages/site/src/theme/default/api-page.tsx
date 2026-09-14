import type { JSX } from "preact";

import {
  OPERATION_TYPE,
  type Attribute,
  type ContractLabels,
  type ContractSectionProps,
  type EntityPageLabels,
  type EntityPageProps,
} from "../../slots.js";
import { useSlot } from "../context.js";
import { AttributeList } from "./attributes.js";
import { ContractSection, defaultContractLabels } from "./contract-section.js";
import { Documents } from "./document-viewer.js";
import { GroupedFilesBlock } from "./grouped-files.js";
import {
  Breadcrumb,
  defaultEntityPageLabels,
  EntityPage,
  NeighbourhoodFold,
  NoteSection,
  PanelBlock,
  Source,
  SpaceMark,
  TypeBadge,
} from "./entity-page.js";
import { SidePanel } from "./panel-handle.js";
import { PinButton } from "./pins.js";
import { SpaceTree } from "./space-tree.js";

/** How many properties the panel of an API page shows: the operations carry the rest. */
export const API_KEYS_MAX = 5;

/** The page of an API whose contract was imported: the same view model, the contract always there. */
export type ApiPageProps = EntityPageProps & { contract: ContractSectionProps };

/**
 * The five keys of an API: the properties the type highlights, in that order, completed by the
 * declared properties of the panel it does not name, cut to `API_KEYS_MAX`. What the header
 * would have shown as highlights stands in the panel instead.
 */
export function apiKeys(
  highlights: readonly Attribute[],
  attributes: readonly Attribute[],
): Attribute[] {
  const named = new Set(highlights.map((attribute) => attribute.name));
  return [...highlights, ...attributes.filter((attribute) => !named.has(attribute.name))].slice(
    0,
    API_KEYS_MAX,
  );
}

/**
 * The page of an interface: the tree of its space on the left, its operations as its children;
 * in the centre the breadcrumb, the title, the line naming the type, the last change and the
 * space, the note, its documents, then the operations table and the contract block; on the
 * right the properties cut to five keys, with the files the build grouped into the page and why
 * at the foot of the block, the related pages with the operations first, and the
 * neighbourhood folded behind its line, served unfolded by `mapOpen` as on the generic page. No
 * highlight on the line under the title and no table of contents: the operations are the grain
 * the page works at.
 */
export function ApiPage({
  entity,
  typeHref,
  space,
  breadcrumb = [],
  changed,
  highlights,
  sections,
  attributes,
  labels: given = {},
  neighbours,
  mentions,
  sources,
  contract,
  documents = [],
  grouping,
  mapOpen = false,
}: ApiPageProps): JSX.Element {
  const MentionsPanel = useSlot("MentionsPanel");
  const text: EntityPageLabels = {
    ...defaultEntityPageLabels(
      neighbours.total ?? neighbours.neighbours.length,
      0,
      space?.name ?? "",
    ),
    ...given,
  };
  const contractText: ContractLabels = { ...defaultContractLabels, ...contract.labels };
  const keys = apiKeys(highlights, attributes);
  return (
    <div class={space === undefined ? "entity entity-api" : "entity entity-with-space entity-api"}>
      {space !== undefined && <SpaceTree space={space} label={text.spaceTree} />}
      <div class="entity-main">
        {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={text.breadcrumb} />}
        <header class="entity-header">
          <h1>{entity.title}</h1>
          <PinButton />
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
          <Documents documents={documents} />
        </article>
        <ContractSection {...contract} />
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
      <SidePanel>
        {(keys.length > 0 || grouping !== undefined) && (
          <PanelBlock
            id="entity-properties"
            className="entity-panel"
            heading={text.properties}
            {...(keys.length === 0 ? {} : { count: keys.length })}
          >
            {keys.length > 0 && <AttributeList entity={entity} attributes={keys} />}
            {keys.length > 0 && <p class="panel-note">{contractText.fiveKeys}</p>}
            {grouping !== undefined && <GroupedFilesBlock grouping={grouping} />}
          </PanelBlock>
        )}
        <MentionsPanel
          {...mentions}
          leadType={OPERATION_TYPE}
          labels={{ ...mentions.labels, orderNote: contractText.operationsFirst }}
        />
        <NeighbourhoodFold neighbours={neighbours} labels={given} open={mapOpen} />
      </SidePanel>
    </div>
  );
}

/** The entity page of the default theme: the page of an interface when the contract was imported, the generic page otherwise. */
export function TypedEntityPage(props: EntityPageProps): JSX.Element {
  return props.contract === undefined ? (
    <EntityPage {...props} />
  ) : (
    <ApiPage {...props} contract={props.contract} />
  );
}
