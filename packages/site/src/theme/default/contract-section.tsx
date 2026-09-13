import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { ContractSectionProps } from "../../slots.js";
import { CONTRACT_VIEWER_ISLAND, ContractViewer } from "./contract-viewer.js";
import { labels } from "./labels.js";

// Created here rather than next to the component, so that the hydration entry bundles no server-side helper.
const ContractViewerIsland = island(CONTRACT_VIEWER_ISLAND, ContractViewer);

/**
 * The contract of an API page, after the note: what the model knows without JavaScript (the title,
 * the version, the import date, the operations as a plain list, the download link) and the island
 * that shows the rest on demand. The markdown of the note is untouched: the contract is displayed,
 * never copied into it.
 */
export function ContractSection(props: ContractSectionProps): JSX.Element {
  return (
    <section class="contract" aria-labelledby="contract-title">
      <h2 id="contract-title">
        {labels.contract} <span class="contract-name">{props.title}</span>
      </h2>
      <p class="contract-meta">
        {props.version !== "" && (
          <span>
            {labels.contractVersion} <code>{props.version}</code>
          </span>
        )}
        <span>
          {labels.contractImportedOn} <time dateTime={props.importedAt}>{props.importedAt}</time>
        </span>
        <a class="contract-download" href={props.downloadHref} download>
          {labels.downloadContract}
        </a>
      </p>
      <h3 id="contract-operations">
        {labels.contractOperations} <span class="count">{props.operations.length}</span>
      </h3>
      {props.operations.length === 0 ? (
        <p class="empty">{labels.contractNoOperation}</p>
      ) : (
        <ul class="contract-operations" aria-labelledby="contract-operations">
          {props.operations.map((operation) => (
            <li key={operation.name}>
              <a href={operation.href}>{operation.title}</a>
              {operation.summary !== undefined && (
                <span class="contract-summary"> {operation.summary}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <ContractViewerIsland href={props.fragmentHref} />
    </section>
  );
}
