import { existsSync } from "node:fs";
import { join } from "node:path";

import { memoryFileSystem, nodeFileSystem, type ConfigIssue } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { loadDefaultProfile, resolveProfile, typesDirectoryOf } from "../src/load.js";
import {
  defaultTypesDirectory,
  MODULE_COMPONENT_PATTERN,
  readTypeModule,
  readTypeModules,
  typeDefinitionOf,
  typesOf,
  type TypeModule,
} from "../src/modules.js";

const root = "/modules/runbook";

/** A complete module: a runbook for operating Concordance, with every optional file. */
const runbookFiles: Record<string, string> = {
  [`${root}/type.yaml`]: [
    "group: quality",
    "glyph: runbook",
    "attributes:",
    "  trigger: { type: string }",
    "  steps: { type: list }",
    "  checks: { type: 'ref[]', target: rule, relation: constrains, inverse: true }",
    "sections:",
    "  steps: { parse: ordered-list, produces: related }",
    "display:",
    "  highlight: [trigger]",
    "",
  ].join("\n"),
  [`${root}/template.md`]: "---\ntype: runbook\ntrigger: a red build\n---\n# Rebuild the site\n",
  [`${root}/schema.json`]: JSON.stringify({
    steps: { type: "object", properties: { action: { type: "string" } } },
  }),
  [`${root}/messages/en.json`]: JSON.stringify({
    "attributes.trigger": { defaultMessage: "Trigger", description: "What starts the runbook." },
    label: { defaultMessage: "Runbook", description: "Label of the type." },
    "sections.steps": { defaultMessage: "Steps", description: "Heading of the steps." },
  }),
  [`${root}/messages/fr.json`]: JSON.stringify({
    "attributes.trigger": "Déclencheur",
    label: "Procédure",
    "sections.steps": "Étapes",
  }),
  [`${root}/components/EntityPage.js`]: "export default () => null;",
  [`${root}/components/Attribute@steps.mjs`]: "export default () => null;",
};

function messages(issues: ConfigIssue[]): string[] {
  return issues.map((issue) => `${issue.path}: ${issue.message}`);
}

function readRunbook(
  overrides: Record<string, string | undefined> = {},
): ReturnType<typeof readTypeModule> {
  const files = new Map(Object.entries(runbookFiles));
  for (const [path, content] of Object.entries(overrides)) {
    if (content === undefined) {
      files.delete(path);
    } else {
      files.set(path, content);
    }
  }
  return readTypeModule(memoryFileSystem(Object.fromEntries(files)), root);
}

function expectModule(reading: ReturnType<typeof readTypeModule>): TypeModule {
  if (!reading.ok) {
    throw new Error(messages(reading.issues).join("\n"));
  }
  return reading.module;
}

describe("readTypeModule", () => {
  it("reads the declaration, the messages by language, the template, the schema and the components", () => {
    const module = expectModule(readRunbook());
    expect(module.slug).toBe("runbook");
    expect(module.directory).toBe(root);
    expect(module.declaration.group).toBe("quality");
    expect(module.declaration.sections).toEqual({
      steps: { parse: "ordered-list", produces: "related" },
    });
    expect(module.messages).toEqual({
      en: { "attributes.trigger": "Trigger", label: "Runbook", "sections.steps": "Steps" },
      fr: { "attributes.trigger": "Déclencheur", label: "Procédure", "sections.steps": "Étapes" },
    });
    expect(module.template).toMatch(/^---\ntype: runbook/);
    expect(module.schema).toEqual({
      steps: { type: "object", properties: { action: { type: "string" } } },
    });
    expect(module.components).toEqual({
      EntityPage: `${root}/components/EntityPage.js`,
      "Attribute@steps": `${root}/components/Attribute@steps.mjs`,
    });
  });

  it("takes the slug from the folder name, with or without a trailing slash", () => {
    const module = expectModule(readTypeModule(memoryFileSystem(runbookFiles), `${root}/`));
    expect(module.slug).toBe("runbook");
    expect(module.directory).toBe(root);
  });

  it("leaves the template, the schema and the components out when the module has none", () => {
    const module = expectModule(
      readRunbook({
        [`${root}/template.md`]: undefined,
        [`${root}/schema.json`]: undefined,
        [`${root}/components/EntityPage.js`]: undefined,
        [`${root}/components/Attribute@steps.mjs`]: undefined,
        [`${root}/messages/fr.json`]: undefined,
      }),
    );
    expect(module.template).toBeUndefined();
    expect(module.schema).toBeUndefined();
    expect(module.components).toEqual({});
    expect(Object.keys(module.messages)).toEqual(["en"]);
  });

  it("refuses a folder whose name is not a type slug", () => {
    const reading = readTypeModule(memoryFileSystem(runbookFiles), "/modules/Run-Book");
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual([": folder name is not a type slug"]);
    expect(reading.issues[0]?.received).toBe("Run-Book");
  });

  it("reports a missing type.yaml", () => {
    const reading = readRunbook({ [`${root}/type.yaml`]: undefined });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual(["type.yaml: file not found"]);
  });

  it("reports a type.yaml that is not valid YAML, with the parser's first line", () => {
    const reading = readRunbook({ [`${root}/type.yaml`]: "group: [\n" });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toHaveLength(1);
    expect(reading.issues[0]?.path).toBe("type.yaml");
    expect(reading.issues[0]?.message).toMatch(/^not valid YAML: /);
    expect(reading.issues[0]?.message).not.toContain("\n");
  });

  it("reports every schema problem of type.yaml at its path, without the key-name duplicates", () => {
    const reading = readRunbook({
      [`${root}/type.yaml`]:
        "glyph: 3\nlabel: { en: Runbook }\nattributes: { Bad-Name: { type: string } }\n",
    });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual([
      "type.yaml: group: required key is missing",
      "type.yaml: label: unknown key",
      "type.yaml: glyph: wrong type",
      "type.yaml: attributes.Bad-Name: key is not allowed",
    ]);
  });

  it("reports a message file that is not JSON or not an object", () => {
    const reading = readRunbook({
      [`${root}/messages/en.json`]: "{",
      [`${root}/messages/fr.json`]: "[]",
    });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual([
      "messages/en.json: not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      "messages/fr.json: wrong type",
      "messages/en.json: label: required message is missing",
      "messages/en.json: sections.steps: required message is missing",
    ]);
  });

  it("reports a message that is neither a string nor a source entry, and one naming nothing declared", () => {
    const reading = readRunbook({
      [`${root}/messages/fr.json`]: JSON.stringify({
        label: 3,
        "attributes.owner": "Responsable",
        "sections.notes": "Notes",
        attributes: "Attributs",
        other: { description: "no default message" },
      }),
    });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual([
      "messages/fr.json: attributes: message names nothing the module declares",
      "messages/fr.json: attributes.owner: message names nothing the module declares",
      "messages/fr.json: label: not a message",
      "messages/fr.json: other: not a message",
      "messages/fr.json: sections.notes: message names nothing the module declares",
    ]);
  });

  it("requires the source language with the label of the type and the heading of every section", () => {
    const missing = readRunbook({ [`${root}/messages/en.json`]: undefined });
    expect(missing.ok).toBe(false);
    expect(messages(missing.issues)).toEqual(["messages/en.json: file not found"]);
    const incomplete = readRunbook({
      [`${root}/messages/en.json`]: JSON.stringify({ "attributes.trigger": "Trigger" }),
    });
    expect(incomplete.ok).toBe(false);
    expect(messages(incomplete.issues)).toEqual([
      "messages/en.json: label: required message is missing",
      "messages/en.json: sections.steps: required message is missing",
    ]);
  });

  it("ignores files of the messages folder that are not a language catalogue", () => {
    const module = expectModule(readRunbook({ [`${root}/messages/README.md`]: "# Messages\n" }));
    expect(Object.keys(module.messages)).toEqual(["en", "fr"]);
  });

  it("reports a schema that is not JSON, not an object, or naming an attribute that is not a list", () => {
    expect(messages(readRunbook({ [`${root}/schema.json`]: "nope" }).issues)).toEqual([
      "schema.json: not valid JSON: Unexpected token 'o', \"nope\" is not valid JSON",
    ]);
    expect(messages(readRunbook({ [`${root}/schema.json`]: "[]" }).issues)).toEqual([
      "schema.json: wrong type",
    ]);
    const reading = readRunbook({
      [`${root}/schema.json`]: JSON.stringify({ trigger: {}, steps: {}, unknown: {} }),
    });
    expect(messages(reading.issues)).toEqual([
      "schema.json: trigger: not a list attribute of the type",
      "schema.json: unknown: not a list attribute of the type",
    ]);
  });

  it("refuses a component that is not a page, an attribute or a section, or that sits in a sub-folder", () => {
    const reading = readRunbook({
      [`${root}/components/Header.js`]: "",
      [`${root}/components/nested/EntityPage.js`]: "",
      [`${root}/components/Attribute@Bad.js`]: "",
    });
    expect(reading.ok).toBe(false);
    expect(messages(reading.issues)).toEqual([
      "components/Attribute@Bad.js: not a component a module may provide",
      "components/Header.js: not a component a module may provide",
      "components/nested/EntityPage.js: not a component a module may provide",
    ]);
  });

  it("names the components a module may provide", () => {
    for (const name of ["EntityPage", "Attribute@steps", "Section@steps"]) {
      expect(MODULE_COMPONENT_PATTERN.test(name), name).toBe(true);
    }
    for (const name of ["Header", "EntityPage@runbook", "Attribute@", "attribute@steps"]) {
      expect(MODULE_COMPONENT_PATTERN.test(name), name).toBe(false);
    }
  });
});

describe("typeDefinitionOf", () => {
  it("turns a module into the type of the profile, labels from the messages, the schema on its list attribute", () => {
    const module = expectModule(readRunbook());
    expect(typeDefinitionOf(module)).toEqual({
      label: { en: "Runbook", fr: "Procédure" },
      group: "quality",
      glyph: "runbook",
      attributes: {
        trigger: { type: "string", label: { en: "Trigger", fr: "Déclencheur" } },
        steps: {
          type: "list",
          schema: { type: "object", properties: { action: { type: "string" } } },
        },
        checks: { type: "ref[]", target: "rule", relation: "constrains", inverse: true },
      },
      sections: {
        steps: {
          heading: { en: "Steps", fr: "Étapes" },
          parse: "ordered-list",
          produces: "related",
        },
      },
      display: { highlight: ["trigger"] },
    });
  });

  it("keeps a schema written in type.yaml over the one of schema.json, and every optional key", () => {
    const module = expectModule(
      readRunbook({
        [`${root}/type.yaml`]: [
          "group: quality",
          "status: planned",
          "graph: documents-only",
          "attributes:",
          "  steps: { type: list, schema: { action: string } }",
          "",
        ].join("\n"),
        [`${root}/messages/en.json`]: JSON.stringify({ label: "Runbook" }),
        [`${root}/messages/fr.json`]: undefined,
      }),
    );
    expect(typeDefinitionOf(module)).toEqual({
      label: { en: "Runbook" },
      group: "quality",
      status: "planned",
      graph: "documents-only",
      attributes: { steps: { type: "list", schema: { action: "string" } } },
    });
  });

  it("leaves a schema entry that is not an object aside", () => {
    const module = expectModule(
      readRunbook({ [`${root}/schema.json`]: JSON.stringify({ steps: true }) }),
    );
    expect(typeDefinitionOf(module).attributes?.["steps"]).toEqual({ type: "list" });
  });
});

describe("readTypeModules", () => {
  it("reads every direct sub-folder holding a type.yaml, in slug order, and reports the faulty ones by folder", () => {
    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(runbookFiles)) {
      files[path.replace(root, "/types/runbook")] = content;
      files[path.replace(root, "/types/checklist")] = content;
    }
    files["/types/broken/type.yaml"] = "group: 3\n";
    files["/types/broken/messages/en.json"] = JSON.stringify({ label: "Broken" });
    files["/types/notes.md"] = "not a module";
    files["/types/deep/inner/type.yaml"] = "group: quality\n";
    const reading = readTypeModules(memoryFileSystem(files), "/types/");
    expect(reading.modules.map((module) => module.slug)).toEqual(["checklist", "runbook"]);
    expect(messages(reading.issues)).toEqual(["broken: type.yaml: group: wrong type"]);
  });
});

describe("typesOf", () => {
  it("assembles the types block by slug order, the last module of a slug winning", () => {
    const runbook = expectModule(readRunbook());
    const other: TypeModule = { ...runbook, slug: "audit" };
    const again: TypeModule = { ...runbook, declaration: { group: "raw" } };
    expect(Object.keys(typesOf([runbook, other]))).toEqual(["audit", "runbook"]);
    expect(typesOf([runbook, again])["runbook"]?.group).toBe("raw");
  });
});

describe("the type modules of the default profile", () => {
  const modules = readTypeModules(nodeFileSystem, defaultTypesDirectory());

  it("assemble into the types of the published profile, type for type", () => {
    expect(modules.issues).toEqual([]);
    const assembled = JSON.parse(JSON.stringify(typesOf(modules.modules))) as unknown;
    expect(assembled).toEqual(loadDefaultProfile().types);
  });

  it("ship a template for every active type and none for a planned one", () => {
    for (const module of modules.modules) {
      const active = module.declaration.status !== "planned";
      expect(module.template !== undefined, module.slug).toBe(active);
      if (module.template !== undefined) {
        expect(module.template, module.slug).toMatch(new RegExp(`^---\\ntype: ${module.slug}\\n`));
      }
    }
  });

  it("carry an English and a French label for the type, every attribute and every section", () => {
    for (const module of modules.modules) {
      const keys = [
        "label",
        ...Object.keys(module.declaration.attributes ?? {}).map((name) => `attributes.${name}`),
        ...Object.keys(module.declaration.sections ?? {}).map((key) => `sections.${key}`),
      ].sort();
      expect(Object.keys(module.messages["en"] ?? {}), module.slug).toEqual(keys);
      expect(Object.keys(module.messages["fr"] ?? {}), module.slug).toEqual(keys);
    }
  });

  it("ship no component: the core types render through the generic template", () => {
    for (const module of modules.modules) {
      expect(module.components, module.slug).toEqual({});
    }
    expect(existsSync(join(defaultTypesDirectory(), "screen", "type.yaml"))).toBe(true);
  });
});

describe("resolveProfile with modules", () => {
  it("merges the modules into the default profile before the project profile", () => {
    const runbook = expectModule(readRunbook());
    const resolution = resolveProfile("types:\n  runbook:\n    glyph: procedure\n", {
      modules: [runbook],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const type = resolution.profile.types["runbook"];
    expect(type?.label).toEqual({ en: "Runbook", fr: "Procédure" });
    expect(type?.glyph).toBe("procedure");
    expect(type?.sections?.["steps"]?.heading).toEqual({ en: "Steps", fr: "Étapes" });
    const plain = resolveProfile();
    expect(plain.ok && resolution.fingerprint !== plain.fingerprint).toBe(true);
  });

  it("merges the modules alone when there is no project profile", () => {
    const resolution = resolveProfile(undefined, { modules: [expectModule(readRunbook())] });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(Object.keys(resolution.profile.types)).toContain("runbook");
    expect(Object.isFrozen(resolution.profile.types["runbook"])).toBe(true);
  });

  it("validates the assembled profile: a module naming an unknown group or relation is reported", () => {
    const module = expectModule(
      readRunbook({
        [`${root}/type.yaml`]: [
          "group: operations",
          "attributes: { trigger: { type: string }, steps: { type: list } }",
          "sections: { steps: { parse: paragraphs, produces: performs } }",
          "",
        ].join("\n"),
      }),
    );
    const resolution = resolveProfile(undefined, { modules: [module] });
    expect(resolution.ok).toBe(false);
    expect(messages(resolution.issues)).toEqual([
      "types.runbook.group: group is not declared",
      "types.runbook.sections.steps.produces: relation is not declared",
    ]);
  });

  it("refuses a module of a type the default profile declares", () => {
    const module: TypeModule = { ...expectModule(readRunbook()), slug: "screen" };
    const resolution = resolveProfile(undefined, { modules: [module] });
    expect(resolution.ok).toBe(false);
    expect(resolution.issues).toEqual([
      {
        severity: "error",
        path: "types.screen",
        message: "type is declared by the default profile; extend it through the project profile",
        received: root,
      },
    ]);
  });

  it("refuses two modules of one type and names both folders", () => {
    const first = expectModule(readRunbook());
    const second: TypeModule = { ...first, directory: "/plugin/types/runbook" };
    const resolution = resolveProfile(undefined, { modules: [first, second] });
    expect(resolution.ok).toBe(false);
    expect(resolution.issues).toEqual([
      {
        severity: "error",
        path: "types.runbook",
        message: "type is declared by two modules",
        received: [root, "/plugin/types/runbook"],
      },
    ]);
  });

  it("drops the types_dir key of a project profile, which the caller reads", () => {
    const resolution = resolveProfile("types_dir: ./types\n");
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect("types_dir" in resolution.profile).toBe(false);
    const plain = resolveProfile();
    expect(plain.ok && plain.fingerprint).toBe(resolution.fingerprint);
  });
});

describe("typesDirectoryOf", () => {
  it("reads the types_dir of a project profile", () => {
    expect(typesDirectoryOf("types_dir: ../types\nversion: 1\n")).toBe("../types");
  });

  it("is undefined without the key, when the key is not a string, or when the text does not parse", () => {
    expect(typesDirectoryOf("version: 1\n")).toBeUndefined();
    expect(typesDirectoryOf("types_dir: [a]\n")).toBeUndefined();
    expect(typesDirectoryOf("- a\n")).toBeUndefined();
    expect(typesDirectoryOf("types_dir: [\n")).toBeUndefined();
  });
});
