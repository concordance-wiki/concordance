// @vitest-environment happy-dom
import type { ContractView } from "@concordance-wiki/core";
import { h, render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContractViewer } from "../../../src/theme/default/contract-viewer.js";

const href = "../../fragments/specs/api/model-query.contract.json";

const view: ContractView = {
  title: "Model query API",
  version: "0.1.0",
  operations: [
    {
      name: "listEntities",
      title: "GET /entities",
      aliases: ["listEntities"],
      attributes: { method: "GET", path: "/entities", style: "http" },
      objects: ["Entity"],
      responses: [{ status: "200", schema: "Entity[]" }],
    },
  ],
  schemas: [
    { name: "Entity", fields: [{ name: "id", type: "string", required: true }] },
    { name: "Severity", type: "string", fields: [] },
  ],
};

/** The viewer with the fetch replaced: the view comes back at once, nothing leaves the test. */
class Answering extends ContractViewer {
  static calls: string[] = [];

  override fetchView = (target: string): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
    Answering.calls.push(target);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(view) });
  };
}

/** Lets the rendering queued by a state change and the promise chain of a fetch run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.includes(text),
  );
  if (found === undefined) throw new Error(`no button ${text}`);
  return found;
}

describe("the contract viewer in a document", () => {
  afterEach(() => {
    render(null, document.body);
    document.body.innerHTML = "";
    Answering.calls = [];
    vi.unstubAllGlobals();
  });

  it("fetches the view as soon as it mounts and opens the viewer in the page, then expands an operation and selects a schema on click", async () => {
    render(h(Answering, { href }), document.body);
    await settle();
    await settle();
    expect(Answering.calls).toEqual([href]);
    expect(document.body.innerHTML).not.toContain("Contract data (JSON)");
    const operation = button("GET /entities");
    expect(operation.getAttribute("aria-expanded")).toBe("false");
    operation.click();
    await settle();
    expect(button("GET /entities").getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("contract-operation-listEntities")?.hidden).toBe(false);
    expect(button("Severity").getAttribute("aria-pressed")).toBe("false");
    button("Severity").click();
    await settle();
    expect(button("Severity").getAttribute("aria-pressed")).toBe("true");
    expect(button("Entity").getAttribute("aria-pressed")).toBe("false");
    expect([...document.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "GET /entities",
      "Entity",
      "Severity",
    ]);
    expect(Answering.calls).toEqual([href]);
  });

  it("uses the fetch of the browser for the fragment href by default, and nothing else", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", (target: unknown) => {
      calls.push(target);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(view) });
    });
    const component = new ContractViewer({ href });
    const setState = vi.spyOn(component, "setState");
    await component.load();
    expect(calls).toEqual([href]);
    expect(setState).toHaveBeenLastCalledWith({
      status: "loaded",
      view,
      open: [],
      schema: "Entity",
    });
  });
});
