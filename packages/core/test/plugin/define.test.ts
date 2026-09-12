import { describe, expect, it } from "vitest";

import type { PluginManifest } from "../../src/plugin/api.js";
import { PluginDefinitionError, definePlugin, isPluginManifest } from "../../src/plugin/define.js";

function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: "@example/plugin-csv",
    version: "0.1.0",
    apiVersion: "1",
    contributes: {
      readers: [{ extensions: [".csv"], read: () => ({ metadata: {}, text: "" }) }],
    },
    ...overrides,
  };
}

function failure(input: PluginManifest): PluginDefinitionError {
  try {
    definePlugin(input);
  } catch (error) {
    if (error instanceof PluginDefinitionError) return error;
  }
  throw new Error("definePlugin did not throw a PluginDefinitionError");
}

describe("definePlugin", () => {
  it("returns a manifest validated by the plugin schema, keeping its functions", () => {
    const input = manifest();
    const defined = definePlugin(input);
    expect(defined).toBe(input);
    expect(
      defined.contributes.readers?.[0]?.read({
        path: "a.csv",
        payload: { bytes: new Uint8Array() },
      }),
    ).toEqual({
      metadata: {},
      text: "",
    });
  });

  it("brands the manifest with a non-enumerable marker recognised by isPluginManifest", () => {
    const defined = definePlugin(manifest());
    expect(isPluginManifest(defined)).toBe(true);
    expect(Object.keys(defined)).toEqual(["name", "version", "apiVersion", "contributes"]);
    expect(Object.getOwnPropertyDescriptor(defined, Symbol.for("concordance-wiki.plugin"))).toEqual(
      { value: true, writable: false, enumerable: false, configurable: false },
    );
    expect(JSON.parse(JSON.stringify(defined))).toEqual({
      name: "@example/plugin-csv",
      version: "0.1.0",
      apiVersion: "1",
      contributes: { readers: [{ extensions: [".csv"] }] },
    });
  });

  it("accepts every contribution point and a system dependency", () => {
    const defined = definePlugin(
      manifest({
        systemDependencies: [{ name: "office suite", check: "soffice", optional: true }],
        contributes: {
          readers: [{ extensions: [".csv"], read: () => ({ metadata: {}, text: "" }) }],
          converters: [
            {
              extensions: [".docx"],
              produces: ["pdf", "thumbnails", "text"],
              convert: () => Promise.resolve({ representations: {}, findings: [] }),
            },
          ],
          sources: [
            {
              kind: "openapi",
              load: () =>
                Promise.resolve({
                  entities: [],
                  links: [],
                  candidates: [],
                  contracts: [],
                  findings: [],
                }),
            },
          ],
          inferenceMethods: [{ method: "by_title", infer: () => ({ links: [] }) }],
          checks: [
            {
              id: "W-CSV-EMPTY",
              severity: "warning",
              description: "d",
              remediation: "r",
              documentation: "https://example.invalid/checks/W-CSV-EMPTY",
              run: () => [],
            },
          ],
          projections: [{ id: "csv_table", render: () => ({ html: "", json: null }) }],
          uiComponents: [{ slot: "viewer", bundle: "./viewer.js" }],
          themes: [
            {
              name: "slate",
              tokens: "./theme.yaml",
              stylesheet: "./theme.css",
              assets: "./assets",
              components: { Footer: "./footer.js" },
            },
          ],
        },
      }),
    );
    expect(Object.keys(defined.contributes)).toHaveLength(8);
  });

  it("rejects a missing apiVersion with the path of the missing key", () => {
    const { apiVersion, ...rest } = manifest();
    expect(apiVersion).toBe("1");
    // The test builds an invalid manifest on purpose; the type is only there to call definePlugin.
    const error = failure(rest as PluginManifest);
    expect(error.name).toBe("PluginDefinitionError");
    expect(error.issues).toEqual([
      { severity: "error", path: "apiVersion", message: "required key is missing" },
    ]);
    expect(error.message).toBe(
      "invalid plugin manifest\nerror: @example/plugin-csv: apiVersion: required key is missing",
    );
  });

  it("reports every issue at once with the value received and the format expected", () => {
    const error = failure(
      manifest({
        apiVersion: "one",
        contributes: {
          readers: [{ extensions: ["csv"], read: () => ({ metadata: {}, text: "" }) }],
          inferenceMethods: [{ method: "By-Title", infer: () => ({ links: [] }) }],
        },
      }),
    );
    expect(error.issues).toEqual([
      {
        severity: "error",
        path: "apiVersion",
        message: "value does not match the expected format",
        received: "one",
        expected: "a value matching ^[0-9]+$",
      },
      {
        severity: "error",
        path: "contributes.readers[0].extensions[0]",
        message: "value does not match the expected format",
        received: "csv",
        expected: "a value matching ^\\.",
      },
      {
        severity: "error",
        path: "contributes.inferenceMethods[0].method",
        message: "value does not match the expected format",
        received: "By-Title",
        expected: "a value matching ^[a-z][a-z0-9_]*$",
      },
    ]);
  });

  it("rejects a check whose documentation is not a URL", () => {
    const error = failure(
      manifest({
        contributes: {
          checks: [
            {
              id: "W-CSV-EMPTY",
              severity: "warning",
              description: "d",
              remediation: "r",
              documentation: "docs/checks/W-CSV-EMPTY.md",
              run: () => [],
            },
          ],
        },
      }),
    );
    expect(error.issues.map((issue) => issue.path)).toEqual([
      "contributes.checks[0].documentation",
    ]);
    expect(error.issues[0]?.message).toBe('must match format "uri"');
  });

  it("rejects a manifest without any contribution", () => {
    const error = failure(manifest({ contributes: {} }));
    expect(error.issues).toEqual([
      {
        severity: "error",
        path: "contributes",
        message: "must NOT have fewer than 1 properties",
        received: {},
      },
    ]);
  });

  it("labels the issues generically when the name itself is not a string", () => {
    // The test builds an invalid manifest on purpose; the type is only there to call definePlugin.
    const error = failure({ ...manifest(), name: 12 } as unknown as PluginManifest);
    expect(error.message).toBe(
      "invalid plugin manifest\nerror: plugin: name: wrong type; received 12; expected string",
    );
  });

  it("validates the data of the manifest only: function-valued keys are not unknown keys", () => {
    const input: PluginManifest & { setup: () => void } = { ...manifest(), setup: () => undefined };
    expect(definePlugin(input)).toBe(input);
  });
});

describe("isPluginManifest", () => {
  it("recognises only objects carrying the brand", () => {
    expect(isPluginManifest(manifest())).toBe(false);
    expect(isPluginManifest(null)).toBe(false);
    expect(isPluginManifest("plugin")).toBe(false);
    expect(isPluginManifest(undefined)).toBe(false);
  });
});
