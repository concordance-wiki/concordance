import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { memoryFileSystem, nodeFileSystem } from "@concordance-wiki/core";
import {
  defaultTypesDirectory,
  loadDefaultProfile,
  readTypeModule,
  readTypeModules,
  resolveProfile,
  type Profile,
  type TypeModule,
} from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { buildGallery } from "../../src/gallery/build.js";
import { galleryPages } from "../../src/gallery/pages.js";
import { typePages } from "../../src/gallery/types.js";
import { importFile } from "../../src/theme/node-loader.js";
import { defaultTheme, resolveTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { count, expectBalanced } from "../helpers/html.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");
const core = readTypeModules(nodeFileSystem, defaultTypesDirectory()).modules;
const profile = loadDefaultProfile();

function runbookModule(): TypeModule {
  const reading = readTypeModule(
    nodeFileSystem,
    resolve(root, "fixtures/plugins/example/types/runbook"),
  );
  if (!reading.ok) throw new Error("the runbook fixture does not read");
  return { ...reading.module, origin: "@concordance-wiki/fixture-plugin-example" };
}

/** The default profile with the runbook of the example plugin merged in. */
function withRunbook(): { profile: Profile; modules: TypeModule[] } {
  const runbook = runbookModule();
  const resolution = resolveProfile(undefined, { modules: [runbook] });
  if (!resolution.ok) throw new Error("the runbook does not merge");
  return { profile: resolution.profile, modules: [...core, runbook] };
}

async function runbookTheme(): Promise<ResolvedTheme> {
  const registry = {
    plugins: () => [],
    registrations: () => [],
    readers: () => [],
    converters: () => [],
    sources: () => [],
    inferenceMethods: () => [],
    checks: () => [],
    projections: () => [],
    uiComponents: () => [],
    themes: () => [],
    types: () => [],
  };
  return resolveTheme(registry, { load: () => Promise.resolve(undefined), loadFile: importFile }, [
    runbookModule(),
  ]);
}

describe("typePages", () => {
  it("renders one page per core type with a template, in slug order, as a note of that type through the generic page", () => {
    const pages = typePages({ profile, modules: core }, defaultTheme);
    const active = Object.entries(profile.types)
      .filter(([, definition]) => definition.status !== "planned")
      .map(([slug]) => slug)
      .sort();
    expect(pages.map((page) => page.type)).toEqual(active);
    expect(pages.map((page) => page.file)).toEqual(active.map((slug) => `type-${slug}.html`));
    const screen = pages.find((page) => page.type === "screen");
    expect(screen?.label).toBe("Screen");
    expect(screen?.override).toBeUndefined();
    expect(screen?.props.entity).toEqual({
      id: "types/screen",
      type: "screen",
      typeLabel: "Screen",
      title: "To-do page",
      locale: "en",
    });
    expect(screen?.props.declaration?.type).toBe("screen");
    expect(screen?.props.highlights.map((attribute) => attribute.name)).toEqual([
      "roles",
      "url_pattern",
      "status",
    ]);
    expect(screen?.props.sections.map((section) => section.key)).toEqual([
      undefined,
      undefined,
      "objects",
      "actions",
      "rules",
    ]);
    expect(screen?.props.otherAttributes).toBeUndefined();
    expect(screen?.props.sources).toEqual([{ source: "templates", path: "screen.md" }]);
  });

  it("marks the page of a type whose component the theme resolved, and shows the attributes its template sets", async () => {
    const { profile: merged, modules } = withRunbook();
    const theme = await runbookTheme();
    const pages = typePages({ profile: merged, modules }, theme);
    const runbook = pages.find((page) => page.type === "runbook");
    expect(runbook?.label).toBe("Runbook");
    expect(runbook?.override).toEqual({
      slot: "EntityPage@runbook",
      plugin: "@concordance-wiki/fixture-plugin-example",
      theme: "type module",
    });
    expect(runbook?.props.highlights).toEqual([
      { name: "trigger", label: "Trigger", values: [{ text: "a red nightly build" }] },
      { name: "owner", label: "Owner", values: [{ text: "roles/maintainer" }] },
    ]);
    expect(runbook?.props.entity.title).toBe("Rebuild the site after a red build");
    expect(runbook?.props.sections.map((section) => section.key)).toEqual([
      undefined,
      "steps",
      "rules",
    ]);
  });

  it("skips a module without a template or of a type the profile does not declare, and reads a template without frontmatter", () => {
    const files = {
      "/types/audit/type.yaml": "group: quality\n",
      "/types/audit/messages/en.json": JSON.stringify({ label: "Audit" }),
      "/types/audit/template.md": "# An audit\n\nText only.\n",
      "/types/listed/type.yaml": "group: quality\n",
      "/types/listed/messages/en.json": JSON.stringify({ label: "Listed" }),
      "/types/listed/template.md": "---\n- not\n- a mapping\n---\n# Listed\n",
      "/types/bare/type.yaml": "group: quality\n",
      "/types/bare/messages/en.json": JSON.stringify({ label: "Bare" }),
      "/types/stranger/type.yaml": "group: quality\n",
      "/types/stranger/messages/en.json": JSON.stringify({ label: "Stranger" }),
      "/types/stranger/template.md": "# Not in the profile\n",
      "/types/untitled/type.yaml": "group: quality\n",
      "/types/untitled/messages/en.json": JSON.stringify({ label: "Untitled" }),
      "/types/untitled/template.md": "No heading at all.\n",
    };
    const { modules } = readTypeModules(memoryFileSystem(files), "/types");
    const declared = modules.filter((module) => module.slug !== "stranger");
    const resolution = resolveProfile(undefined, { modules: declared });
    if (!resolution.ok) throw new Error("the modules do not merge");
    const pages = typePages({ profile: resolution.profile, modules }, defaultTheme);
    expect(pages.map((page) => page.type)).toEqual(["audit", "listed", "untitled"]);
    expect(pages[0]?.props.entity.title).toBe("An audit");
    expect(pages[0]?.props.attributes.map((attribute) => attribute.name)).toEqual(["status"]);
    expect(pages[1]?.props.otherAttributes).toBeUndefined();
    expect(pages[2]?.props.entity.title).toBe("untitled");
  });
});

describe("the gallery with the registered types", () => {
  it("writes one page per type after the fixture pages, lists them in the index with their component, and passes the accessibility checks", async () => {
    const { profile: merged, modules } = withRunbook();
    const theme = await runbookTheme();
    const fileSystem = memoryFileSystem();
    const report = await buildGallery({
      output: "/out",
      theme,
      fileSystem,
      types: { profile: merged, modules },
    });
    const html = fileSystem.listFiles("/out").filter((file) => file.endsWith(".html"));
    const typeFiles = html.filter((file) => file.startsWith("type-"));
    expect(typeFiles.length).toBe(16);
    expect(html).toHaveLength(galleryPages.length + typeFiles.length + 1);
    expect(report.problems).toEqual([]);
    const index = fileSystem.readText("/out/index.html");
    expect(index).toContain('<h2 id="gallery-types">Types</h2>');
    expect(index).toContain('<a href="type-screen.html">screen</a>: Screen, generic entity page');
    expect(index).toContain(
      '<a href="type-runbook.html">runbook</a>: Runbook, <code>EntityPage@runbook</code> of <code>@concordance-wiki/fixture-plugin-example</code>, <code>type module</code>',
    );
    expect(count(index, ", generic entity page</li>")).toBe(15);
    const runbook = fileSystem.readText("/out/type-runbook.html");
    expect(runbook).toContain('class="entity runbook"');
    expect(runbook).toContain("Trigger: a red nightly build");
    expect(runbook).toContain("<title>Type runbook</title>");
    expectBalanced(runbook);
    const screen = fileSystem.readText("/out/type-screen.html");
    expect(screen).toContain('<span class="badge">Screen</span>');
    expect(screen).toContain("<h1>To-do page</h1>");
    expect(screen).toContain(
      '<h2 id="entity-properties">Properties<span class="count panel-count">3</span></h2>',
    );
    expect(report.summary).toContain(
      "override EntityPage@runbook: plugin @concordance-wiki/fixture-plugin-example, theme type module",
    );
  });

  it("writes no type page and no types section without registered types", async () => {
    const fileSystem = memoryFileSystem();
    await buildGallery({ output: "/out", theme: defaultTheme, fileSystem });
    expect(fileSystem.listFiles("/out").some((file) => file.startsWith("type-"))).toBe(false);
    expect(fileSystem.readText("/out/index.html")).not.toContain("gallery-types");
  });
});
