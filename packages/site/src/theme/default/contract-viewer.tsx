import type {
  ContractOperation,
  ContractParameter,
  ContractResponse,
  ContractSchema,
  ContractView,
} from "@concordance-wiki/core";
import { Component, type JSX } from "preact";

import { labels } from "./labels.js";

export const CONTRACT_VIEWER_ISLAND = "contract-viewer";

export interface ContractViewerProps {
  /** The JSON view of the contract, relative to the page; fetched on demand, never embedded. */
  href: string;
}

export type ContractViewerStatus = "loading" | "loaded" | "failed";

export interface ContractViewerState {
  /** False in the served HTML and until the island mounts: a link to the JSON stands in for the viewer. */
  hydrated: boolean;
  status: ContractViewerStatus;
  view?: ContractView;
  /** Names of the operations whose details are open. */
  open: string[];
  /** Name of the schema shown in the explorer. */
  schema?: string;
}

/** How the fetching is done; the browser's `fetch` by default, a double under test. */
export type FetchView = (href: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

function isView(value: unknown): value is ContractView {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { operations?: unknown }).operations) &&
    Array.isArray((value as { schemas?: unknown }).schemas)
  );
}

/** The signature line of an operation: method and path for HTTP, port and binding for SOAP. */
export function signatureOf(operation: ContractOperation): string {
  const { method, path, port, binding } = operation.attributes;
  if (typeof method === "string" && typeof path === "string") return `${method} ${path}`;
  const parts = [port, binding].filter((part): part is string => typeof part === "string");
  return parts.length === 0 ? operation.name : `${operation.name} (${parts.join(", ")})`;
}

function Parameters({ parameters }: { parameters: ContractParameter[] }): JSX.Element {
  return (
    <table class="contract-table">
      <caption>{labels.parameters}</caption>
      <thead>
        <tr>
          <th scope="col">{labels.parameterName}</th>
          <th scope="col">{labels.parameterIn}</th>
          <th scope="col">{labels.parameterType}</th>
        </tr>
      </thead>
      <tbody>
        {parameters.map((parameter) => (
          <tr key={`${parameter.in} ${parameter.name}`}>
            <td>
              <code>{parameter.name}</code>
              {parameter.required && <span class="contract-required"> {labels.required}</span>}
            </td>
            <td>{parameter.in}</td>
            <td>
              <code>{parameter.type}</code>
              {parameter.description !== undefined && (
                <span class="contract-description"> {parameter.description}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Responses({ responses }: { responses: ContractResponse[] }): JSX.Element {
  return (
    <table class="contract-table">
      <caption>{labels.responses}</caption>
      <thead>
        <tr>
          <th scope="col">{labels.responseStatus}</th>
          <th scope="col">{labels.responseBody}</th>
        </tr>
      </thead>
      <tbody>
        {responses.map((response) => (
          <tr key={`${response.status} ${response.description ?? ""}`}>
            <td>
              <code>{response.status}</code>
              {response.description !== undefined && (
                <span class="contract-description"> {response.description}</span>
              )}
            </td>
            <td>{response.schema === undefined ? "—" : <code>{response.schema}</code>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Fields({ schema }: { schema: ContractSchema }): JSX.Element {
  if (schema.fields.length === 0) {
    return <p class="contract-empty">{labels.noField}</p>;
  }
  return (
    <table class="contract-table">
      <thead>
        <tr>
          <th scope="col">{labels.fieldName}</th>
          <th scope="col">{labels.fieldType}</th>
          <th scope="col">{labels.fieldDescription}</th>
        </tr>
      </thead>
      <tbody>
        {schema.fields.map((field) => (
          <tr key={field.name}>
            <td>
              <code>{field.name}</code>
              {field.required && <span class="contract-required"> {labels.required}</span>}
            </td>
            <td>
              <code>{field.type}</code>
            </td>
            <td>{field.description ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The contract viewer, mounted on the API page as an island: a link to the JSON view in the served
 * HTML, and as soon as the script runs one fetch of that view, then an expandable operation list
 * and a schema explorer open in the page, both read-only. Nothing here posts anything anywhere:
 * the viewer shows a contract, it never calls the API it describes.
 */
export class ContractViewer extends Component<ContractViewerProps, ContractViewerState> {
  override state: ContractViewerState = { hydrated: false, status: "loading", open: [] };

  /** Replaceable so that tests fetch nothing; the bundle uses the browser's `fetch`. */
  fetchView: FetchView = (href) => fetch(href);

  /** Opens the viewer as soon as the island mounts, as the document page opens its own. */
  override componentDidMount(): void {
    this.setState({ hydrated: true });
    void this.load();
  }

  /** Fetches the view once; every failure, network or shape, leaves the link to the JSON. */
  load = (): Promise<void> => {
    this.setState({ status: "loading" });
    return this.fetchView(this.props.href)
      .then((response) => (response.ok ? response.json() : undefined))
      .then(
        (body: unknown) => {
          if (!isView(body)) {
            this.setState({ status: "failed" });
            return;
          }
          const first = body.schemas[0];
          this.setState({
            status: "loaded",
            view: body,
            open: [],
            ...(first === undefined ? {} : { schema: first.name }),
          });
        },
        () => {
          this.setState({ status: "failed" });
        },
      );
  };

  toggle = (name: string): void => {
    this.setState((state) => ({
      open: state.open.includes(name)
        ? state.open.filter((candidate) => candidate !== name)
        : [...state.open, name],
    }));
  };

  select = (name: string): void => {
    this.setState({ schema: name });
  };

  private renderOperation(operation: ContractOperation, open: boolean): JSX.Element {
    const id = `contract-operation-${operation.name.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
    const parameters = operation.parameters ?? [];
    const responses = operation.responses ?? [];
    return (
      <li key={operation.name} class="contract-operation">
        <button
          type="button"
          aria-expanded={open ? "true" : "false"}
          aria-controls={id}
          onClick={() => {
            this.toggle(operation.name);
          }}
        >
          <code>{signatureOf(operation)}</code>
          {operation.summary !== undefined && (
            <span class="contract-summary"> {operation.summary}</span>
          )}
        </button>
        <div id={id} hidden={!open} class="contract-operation-details">
          {parameters.length > 0 && <Parameters parameters={parameters} />}
          {operation.request !== undefined && (
            <p>
              {labels.request}: <code>{operation.request}</code>
            </p>
          )}
          {responses.length > 0 && <Responses responses={responses} />}
        </div>
      </li>
    );
  }

  private renderSchemas(view: ContractView, selected: string | undefined): JSX.Element {
    if (view.schemas.length === 0) {
      return <p class="contract-empty">{labels.contractNoSchema}</p>;
    }
    const shown = view.schemas.find((schema) => schema.name === selected) ?? view.schemas[0];
    return (
      <div class="contract-schemas">
        <ul class="contract-schema-list">
          {view.schemas.map((schema) => (
            <li key={schema.name}>
              <button
                type="button"
                aria-pressed={schema === shown ? "true" : "false"}
                onClick={() => {
                  this.select(schema.name);
                }}
              >
                {schema.name}
              </button>
            </li>
          ))}
        </ul>
        {shown !== undefined && (
          <div class="contract-schema">
            <h4>
              <code>{shown.name}</code>
              {shown.type !== undefined && <span class="contract-description"> {shown.type}</span>}
            </h4>
            {shown.description !== undefined && <p>{shown.description}</p>}
            <Fields schema={shown} />
          </div>
        )}
      </div>
    );
  }

  override render(
    props: Readonly<ContractViewerProps>,
    state: Readonly<ContractViewerState>,
  ): JSX.Element {
    if (!state.hydrated || state.status === "failed") {
      return (
        <p class="contract-data">
          {state.status === "failed" && `${labels.contractUnavailable} `}
          <a href={props.href}>{labels.contractData}</a>
        </p>
      );
    }
    if (state.status === "loading" || state.view === undefined) {
      return (
        <p class="contract-data" aria-busy="true">
          {labels.loadingContract}
        </p>
      );
    }
    const { view } = state;
    return (
      <div class="contract-viewer">
        <h3>{labels.contractOperations}</h3>
        {view.operations.length === 0 ? (
          <p class="contract-empty">{labels.contractNoOperation}</p>
        ) : (
          <ul class="contract-operation-list">
            {view.operations.map((operation) =>
              this.renderOperation(operation, state.open.includes(operation.name)),
            )}
          </ul>
        )}
        <h3>{labels.contractSchemas}</h3>
        {this.renderSchemas(view, state.schema)}
      </div>
    );
  }
}
