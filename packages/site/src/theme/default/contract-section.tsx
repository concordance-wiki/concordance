import type { JSX } from "preact";

import { island } from "../../islands/island.js";
import type { ContractLabels, ContractOperationItem, ContractSectionProps } from "../../slots.js";
import { CONTRACT_VIEWER_ISLAND, ContractViewer } from "./contract-viewer.js";
import { labels } from "./labels.js";

// Created here rather than next to the component, so that the hydration entry bundles no server-side helper.
const ContractViewerIsland = island(CONTRACT_VIEWER_ISLAND, ContractViewer);

/** The labels of the default theme, used for every label the section does not receive. */
export const defaultContractLabels: ContractLabels = {
  operations: labels.contractOperations,
  operationsLead: labels.apiOperationsLead,
  gapsLead: labels.apiGapsLead,
  method: labels.apiMethod,
  path: labels.apiPath,
  operation: labels.apiOperation,
  callersColumn: labels.apiCallers,
  noOperation: labels.contractNoOperation,
  withoutPage: labels.apiWithoutPage,
  notInContract: labels.apiNotInContract,
  unknownPath: labels.apiUnknownPath,
  contract: labels.apiContract,
  download: labels.downloadContract,
  viewerNote: labels.apiViewerNote,
  fiveKeys: labels.apiFiveKeys,
  operationsFirst: labels.apiOperationsFirst,
};

/** The methods the chip shortens so that every method reads in the same width. */
const SHORT_METHODS: Record<string, string> = { DELETE: "DEL", OPTIONS: "OPT" };

/** The method as a chip: upper case, the long ones abbreviated with their full name kept for assistive technology, a dashed blank without one. */
function MethodChip({ method }: { method: string | undefined }): JSX.Element {
  if (method === undefined) {
    return (
      <span class="api-method api-method-none" aria-hidden="true">
        —
      </span>
    );
  }
  const upper = method.toUpperCase();
  const short = SHORT_METHODS[upper];
  return (
    <span class="api-method">
      {short === undefined ? upper : <abbr title={upper}>{short}</abbr>}
    </span>
  );
}

/** A gap between the contract and the notes: an operation without a note, or a note without an operation. */
type Gap = "without-page" | "not-in-contract";

function Row({
  operation,
  gap,
  text,
}: {
  operation: ContractOperationItem;
  gap?: Gap;
  text: ContractLabels;
}): JSX.Element {
  const path = operation.path ?? text.unknownPath;
  return (
    <tr class={gap === undefined ? "api-row" : `api-row api-gap api-gap-${gap}`}>
      <td class="api-cell-method">
        <MethodChip method={operation.method} />
      </td>
      <td class="api-cell-path">
        <code>{path}</code>
      </td>
      <td class="api-cell-operation">
        {gap === "without-page" ? (
          <span class="api-operation">{operation.title}</span>
        ) : (
          <a class="api-operation" href={operation.href}>
            {operation.title}
          </a>
        )}
      </td>
      <td class="api-cell-callers">
        {gap === undefined ? (
          operation.callers
        ) : (
          <em class="api-gap-note">
            {gap === "without-page" ? text.withoutPage : text.notInContract}
          </em>
        )}
      </td>
    </tr>
  );
}

/**
 * The operations of the API as a table: the ones a note describes first, in model order, each
 * with its method as a chip, its path, the title of its note and how many pages cite it; then
 * the gaps in italics, the operations the contract declares without a note, and the notes the
 * contract does not declare. Every row is text in the served page.
 */
function Operations({
  props,
  text,
}: {
  props: ContractSectionProps;
  text: ContractLabels;
}): JSX.Element {
  const described = props.operations.filter((operation) => operation.documented);
  const withoutPage = props.operations.filter((operation) => !operation.documented);
  const notInContract = props.unmatched ?? [];
  const gaps = withoutPage.length + notInContract.length;
  return (
    <section class="api-operations" aria-labelledby="api-operations-title">
      <h2 id="api-operations-title">{text.operations}</h2>
      <p class="api-lead">
        {text.operationsLead}
        {gaps > 0 && ` ${text.gapsLead}`}
      </p>
      {described.length + gaps === 0 ? (
        <p class="empty">{text.noOperation}</p>
      ) : (
        <table class="api-table">
          <thead class="visually-hidden">
            <tr>
              <th scope="col">{text.method}</th>
              <th scope="col">{text.path}</th>
              <th scope="col">{text.operation}</th>
              <th scope="col">{text.callersColumn}</th>
            </tr>
          </thead>
          <tbody>
            {described.map((operation) => (
              <Row key={operation.name} operation={operation} text={text} />
            ))}
            {withoutPage.map((operation) => (
              <Row key={operation.name} operation={operation} gap="without-page" text={text} />
            ))}
            {notInContract.map((operation) => (
              <Row key={operation.href} operation={operation} gap="not-in-contract" text={text} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * The contract side of an API page, after the note: the operations table, then the contract
 * block, its format, its file, its import date and its download link on one line, and the
 * viewer island, which shows the operations and schemas on demand, with the note that nothing
 * of the contract is copied into the text. The markdown of the note is untouched.
 */
export function ContractSection(props: ContractSectionProps): JSX.Element {
  const text: ContractLabels = { ...defaultContractLabels, ...props.labels };
  const imported = props.imported;
  return (
    <>
      <Operations props={props} text={text} />
      <section class="contract" aria-labelledby="contract-title">
        <h2 id="contract-title">{text.contract}</h2>
        <div class="contract-card">
          <p class="contract-meta">
            <span class="contract-format">{props.format}</span>
            <code class="contract-file">{props.location}</code>
            <time class="contract-imported" dateTime={props.importedAt}>
              {imported === undefined ? props.importedAt : imported.label}
            </time>
            <a class="contract-download" href={props.downloadHref} download>
              {text.download}
            </a>
          </p>
          <div class="contract-body">
            <ContractViewerIsland href={props.fragmentHref} />
            <p class="contract-note">{text.viewerNote}</p>
          </div>
        </div>
      </section>
    </>
  );
}
