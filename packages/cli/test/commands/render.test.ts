import { definePlugin, type PluginManifest } from "@concordance-wiki/core";
import { defaultComponents } from "@concordance-wiki/site";
import { h, type JSX } from "preact";
import { describe, expect, it } from "vitest";

import { buildCommand } from "../../src/commands/build.js";
import {
  placeImages,
  readFragments,
  renderCommand,
  siteNames,
  sourceRefs,
} from "../../src/commands/render.js";
import type { ThemeDependencies } from "../../src/commands/theme.js";
import { main } from "../../src/main.js";
import { recordedIo, validConfig, type RecordedIo } from "../helpers.js";
import { localTargets, references } from "../links.js";

const palette =
  "{ bg: '#F4F7FB', surface: '#FFFFFF', border: '#D5DCE6', ink: '#101820', muted: '#4A5566', accent: '#1F5FA8' }";
const projectTheme = `name: Concordance handbook\nlight: ${palette}\ndark: ${palette}\nfooter: { credit: true }\n`;

/** Two notes linking each other and a recurring expression, so that the model has links and a keyword page. */
function corpus(config = validConfig): RecordedIo {
  return recordedIo({
    "/work/concordance.yaml": config,
    "/work/notes/a.md":
      "---\ntype: screen\nowner: team-a\n---\n# Screen A\n\nShows [B](b.md) and the build summary; Term B is recognised.\n\n![the screen](figures/a.svg)\n\n## Steps\n\n1. The build summary is printed.\n",
    "/work/notes/figures/a.svg": "<svg/>",
    "/work/notes/b.md":
      "---\ntype: term\n---\n# Term B\n\nUsed by [A](a.md); the build summary names it.\n",
    "/work/notes/c.md": "# Note C\n\nA third note about the build summary, next to [B](b.md).\n",
  });
}

/** The site files of an output folder: everything but the model, the log and the fragments. */
function siteFiles(io: RecordedIo, output = "/work/dist"): string[] {
  return io.fs
    .listFiles(output)
    .filter(
      (file) =>
        file !== "model.json" && file !== "build.log.json" && !file.startsWith("fragments/"),
    );
}

function removeSite(io: RecordedIo, output = "/work/dist"): void {
  for (const file of siteFiles(io, output)) {
    io.fs.remove(`${output}/${file}`);
  }
}

function themePlugin(components: Record<string, string> = {}): PluginManifest {
  return definePlugin({
    name: "@example/theme",
    version: "1.0.0",
    apiVersion: "1",
    contributes: { themes: [{ name: "custom", tokens: "./theme.yaml", components }] },
  });
}

function fakeDependencies(component: unknown, failure?: unknown): ThemeDependencies {
  return {
    load: () => Promise.resolve(themePlugin({ Footer: "./footer.js" })),
    commandAvailable: () => Promise.resolve(true),
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a loader may reject with anything
    loadTheme: () => (failure === undefined ? Promise.resolve(component) : Promise.reject(failure)),
  };
}

/** A footer that breaks an accessibility rule: an image without alternative text. */
function BareFooter(): JSX.Element {
  return h("footer", { class: "site-footer" }, h("img", { src: "x.png" }));
}

describe("concordance render reads model.json and writes dist/: one HTML page per entity and per keyword, the JSON fragments, the search index, the previews and the static assets", () => {
  it("renders the same site as the build from the model and the fragments alone, byte for byte", async () => {
    const io = corpus();
    expect(await buildCommand([], io)).toBe(0);
    const built = new Map(
      siteFiles(io).map((file) => [file, io.fs.readText(`/work/dist/${file}`)]),
    );
    expect(built.size).toBeGreaterThan(6);
    removeSite(io);
    expect(siteFiles(io)).toEqual([]);
    io.stdout.length = 0;
    io.stderr.length = 0;
    expect(await renderCommand([], io)).toBe(0);
    expect(
      new Map(siteFiles(io).map((file) => [file, io.fs.readText(`/work/dist/${file}`)])),
    ).toEqual(built);
    expect(io.stdout[0]).toBe("/work/concordance.yaml: valid configuration");
    expect(io.stdout[1]).toMatch(/^site: \d+ pages written to \/work\/dist$/);
    expect(io.stdout).toContain("accessibility: 0 findings");
    expect(io.stderr).toEqual([]);
  });

  it("writes one page per entity and per keyword, the search index and the assets, the note text served in the HTML", async () => {
    const io = corpus();
    await buildCommand([], io);
    const files = siteFiles(io);
    expect(files).toContain("notes/a/index.html");
    expect(files).toContain("notes/b/index.html");
    expect(files).toContain("notes/c/index.html");
    expect(files).toContain("keywords/build-summary/index.html");
    expect(files).toContain("index.html");
    expect(files).toContain("index/index.html");
    expect(files).toContain("todo/index.html");
    expect(files).toContain("search-index.json");
    expect(files).toContain("assets/site.css");
    // One note fragment per entity, and one mentions fragment per entity another note cites.
    expect(io.fs.listFiles("/work/dist/fragments")).toEqual([
      "keywords/build-summary.json",
      "keywords/build.json",
      "keywords/summary.json",
      "notes/a.json",
      "notes/a.mentions.json",
      "notes/a/figures/a.svg",
      "notes/b.json",
      "notes/b.mentions.json",
      "notes/c.json",
    ]);
    const page = io.fs.readText("/work/dist/notes/a/index.html");
    expect(page).toContain("<h1>Screen A</h1>");
    expect(page).toContain('<a href="../b/index.html" class="written">B</a>');
    expect(page).toContain('<a href="../b/index.html" class="recognised">Term B</a>');
    expect(page).toContain('<img src="figures/a.svg" alt="the screen">');
    expect(io.fs.readText("/work/dist/notes/a/figures/a.svg")).toBe("<svg/>");
    expect(page).toContain(
      '<footer class="legend"><span class="legend-written">link written in the note</span><span class="legend-recognised">word recognised at indexing</span></footer>',
    );
    expect(page).toContain('<p class="entity-source">source: <code>notes/a.md</code></p>');
    expect(page).toContain("<h2>Steps</h2>");
    expect(page).toContain("<title>Screen A – Wiki</title>");
    const keyword = io.fs.readText("/work/dist/keywords/build-summary/index.html");
    expect(keyword).toContain("<h1>build summary</h1>");
    expect(keyword).toContain("<q>");
    const todo = io.fs.readText("/work/dist/todo/index.html");
    expect(todo).toContain('<a href="../keywords/build-summary/index.html">build summary</a>');
  });

  it("writes every href and src relative to the page, resolving to a written file, so that the site works over file://", async () => {
    const io = corpus();
    await buildCommand([], io);
    const written = new Set(io.fs.listFiles("/work/dist"));
    for (const file of siteFiles(io).filter((candidate) => candidate.endsWith(".html"))) {
      const html = io.fs.readText(`/work/dist/${file}`);
      for (const reference of references(html)) {
        expect(reference.startsWith("/")).toBe(false);
      }
      for (const { reference, target } of localTargets(file, html)) {
        expect(written.has(target), `${file}: ${reference} resolves to ${target}`).toBe(true);
      }
    }
  });

  it("reads the model named by --model, its fragments next to it, and writes under --output", async () => {
    const io = corpus();
    await buildCommand(["--output", "/elsewhere/model"], io);
    io.stdout.length = 0;
    expect(
      await renderCommand(["--model", "/elsewhere/model/model.json", "--output", "site"], io),
    ).toBe(0);
    expect(io.stdout[1]).toMatch(/^site: \d+ pages written to \/work\/site$/);
    expect(io.fs.readText("/work/site/notes/a/index.html")).toContain("<h2>Steps</h2>");
    expect(io.fs.exists("/work/site/model.json")).toBe(false);
    expect(io.fs.readText("/work/site/notes/a/figures/a.svg")).toBe("<svg/>");
  });

  it("places the images the build kept under fragments/ next to their pages, skipping one the build did not keep", () => {
    const io = corpus();
    io.fs.writeText("/work/dist/fragments/notes/a/figures/a.svg", "<svg/>");
    const fragments = new Map([
      [
        "notes/a",
        {
          id: "notes/a",
          sections: [],
          images: [
            { source: "notes", path: "figures/a.svg", target: "notes/a/figures/a.svg" },
            { source: "notes", path: "figures/gone.svg", target: "notes/a/figures/gone.svg" },
          ],
        },
      ],
      ["notes/b", { id: "notes/b", sections: [] }],
    ]);
    expect(placeImages(io.fs, fragments, "/work/dist", "/work/site")).toBe(1);
    expect(io.fs.listFiles("/work/site")).toEqual(["notes/a/figures/a.svg"]);
  });

  it("renders the pages without their note text and warns when the fragments are missing", async () => {
    const io = corpus();
    await buildCommand([], io);
    io.fs.remove("/work/dist/fragments");
    io.stderr.length = 0;
    expect(await renderCommand([], io)).toBe(0);
    expect(io.stderr).toEqual([
      "warning: 6 entities have no fragment under /work/dist; their pages carry no note text",
    ]);
    expect(io.fs.readText("/work/dist/notes/a/index.html")).not.toContain("<h2>Steps</h2>");
  });

  it("passes project.edit_url and build.mentions_inline to the pages", async () => {
    const io = corpus(
      [
        "version: 1",
        "project: { name: Wiki, edit_url: 'https://forge.example/{source}/edit/{path}' }",
        "sources: [{ name: notes, path: ./notes }]",
        "build: { mentions_inline: 1 }",
        "",
      ].join("\n"),
    );
    expect(await buildCommand([], io)).toBe(0);
    const page = io.fs.readText("/work/dist/notes/b/index.html");
    expect(page).toContain('<a class="entity-edit" href="https://forge.example/notes/edit/b.md">');
    expect(page.split('<li class="mention').length - 1).toBe(1);
    expect(page).toContain('<a href="../../fragments/notes/b.mentions.json">');
    const mentions = JSON.parse(io.fs.readText("/work/dist/fragments/notes/b.mentions.json")) as {
      mentions: unknown[];
    };
    expect(mentions.mentions.length).toBeGreaterThan(1);
  });

  it("links the edit page of the forge from a git source URL on its declared ref when no edit_url is configured", async () => {
    const io = recordedIo({
      "/work/concordance.yaml":
        "version: 1\nproject: { name: W }\nsources: [{ name: specs, git: https://github.com/concordance-wiki/demo-specs.git, ref: develop }]\n",
    });
    expect(await buildCommand([], io)).toBe(0);
    expect(io.fs.readText("/work/dist/specs/readme/index.html")).toContain(
      '<a class="entity-edit" href="https://github.com/concordance-wiki/demo-specs/edit/develop/README.md">Edit in the forge</a>',
    );
    expect(
      sourceRefs({
        version: 1,
        project: { name: "W" },
        sources: [
          { name: "a", git: "https://github.com/o/a.git", ref: "v2" },
          { name: "b", path: "./b" },
        ],
      }),
    ).toEqual({ a: "v2" });
  });

  it("takes the output folder from build.output, resolved against the configuration", async () => {
    const io = corpus(`${validConfig}build: { output: ../out }\n`);
    await buildCommand([], io);
    removeSite(io, "/out");
    expect(await renderCommand([], io)).toBe(0);
    expect(io.fs.exists("/out/index.html")).toBe(true);
  });

  it("exits 2 when the model is missing and says to build first", async () => {
    const io = corpus();
    expect(await renderCommand([], io)).toBe(2);
    expect(io.stderr).toEqual([
      "/work/dist/model.json: model not found; run concordance build first",
    ]);
  });

  it("exits 1 when the model does not match its schema, one line per issue", async () => {
    const io = corpus();
    io.fs.writeText("/work/dist/model.json", '{"version": 2}\n');
    expect(await renderCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("render stopped: the model does not match its schema");
    expect(io.stderr.length).toBeGreaterThan(1);
    expect(io.stderr[0]).toContain("/work/dist/model.json");
    io.fs.writeText("/work/dist/model.json", "{");
    io.stderr.length = 0;
    expect(await renderCommand([], io)).toBe(1);
    expect(io.stderr[0]).toContain("not valid JSON");
  });

  it("validates the configuration and the profile first", async () => {
    const invalid = recordedIo({ "/work/concordance.yaml": "version: 1\n" });
    expect(await renderCommand([], invalid)).toBe(1);
    expect(invalid.stderr.at(-1)).toBe("render stopped: fix the configuration first");
    const missing = recordedIo();
    expect(await renderCommand(["--config", "nope.yaml"], missing)).toBe(2);
    const profile = corpus(`${validConfig}profile: ./profile.yaml\n`);
    expect(await renderCommand([], profile)).toBe(1);
    expect(profile.stderr).toEqual([
      "/work/profile.yaml: profile file not found",
      "render stopped: fix the profile first",
    ]);
  });

  it("renders with the theme.yaml next to the configuration: its name, its credit, and stops on a faulty one", async () => {
    const io = corpus();
    io.fs.writeText("/work/theme.yaml", projectTheme);
    expect(await buildCommand([], io)).toBe(0);
    const home = io.fs.readText("/work/dist/index.html");
    expect(home).toContain("<title>Concordance handbook</title>");
    expect(home).toContain("Built with Concordance");
    expect(io.stdout).toContain("theme: Concordance handbook, from /work/theme.yaml");
    io.fs.writeText("/work/theme.yaml", "name: 3\n");
    io.stderr.length = 0;
    expect(await renderCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("render stopped: fix /work/theme.yaml first");
    expect(await buildCommand([], io)).toBe(1);
    expect(io.stderr.at(-1)).toBe("build stopped: fix /work/theme.yaml first");
  });

  it("renders through the plugin theme of the configuration, and exits 2 when a component cannot be loaded", async () => {
    const io = corpus(`${validConfig}plugins: ['@example/theme']\n`);
    expect(await buildCommand([], io, fakeDependencies(defaultComponents.Footer))).toBe(0);
    expect(io.stdout).toContain("override Footer: plugin @example/theme, theme custom");
    io.stderr.length = 0;
    expect(await renderCommand([], io, fakeDependencies("not a component"))).toBe(2);
    expect(io.stderr).toEqual([
      "render: cannot resolve the theme: plugin @example/theme, theme custom: the default export of ./footer.js is not a component",
    ]);
    expect(await buildCommand([], io, fakeDependencies("not a component"))).toBe(2);
    io.stderr.length = 0;
    expect(await renderCommand([], io, fakeDependencies(undefined, "gone"))).toBe(2);
    expect(io.stderr).toEqual(["render: cannot resolve the theme: gone"]);
  });

  it("reports an accessibility finding of a page as a warning on stderr and in the summary, without failing", async () => {
    const io = corpus(`${validConfig}plugins: ['@example/theme']\n`);
    expect(await renderCommand([], io, fakeDependencies(BareFooter)).catch(() => 2)).toBe(2);
    expect(await buildCommand([], io, fakeDependencies(BareFooter))).toBe(0);
    expect(io.stdout.find((line) => line.startsWith("accessibility: "))).toBe(
      "accessibility: 9 findings",
    );
    expect(io.stderr).toContain(
      'warning: index.html: img-alt: <img src="x.png"> has no alt attribute',
    );
  });

  it("is dispatched by the command line", async () => {
    const io = corpus();
    await main(["build"], io);
    io.stdout.length = 0;
    expect(await main(["render"], io)).toBe(0);
    expect(io.stdout[1]).toMatch(/^site: /);
  });
});

describe("siteNames", () => {
  it("names the applications and the domains by their title, subdomains by their id path", () => {
    expect(
      siteNames({
        version: 1,
        project: { name: "W" },
        sources: [],
        applications: [
          { id: "concordance-cli", title: "Command line" },
          { id: "concordance-service" },
        ],
        domains: [
          { id: "inference", title: "Inference", subdomains: [{ id: "recognition" }] },
          { id: "quality" },
        ],
      }),
    ).toEqual({
      applications: {
        "concordance-cli": "Command line",
        "concordance-service": "concordance-service",
      },
      domains: {
        inference: "Inference",
        "inference/recognition": "recognition",
        quality: "quality",
      },
    });
    expect(siteNames({ version: 1, project: { name: "W" }, sources: [] })).toEqual({
      applications: {},
      domains: {},
    });
  });
});

describe("readFragments", () => {
  it("throws with the file name when a fragment is malformed", async () => {
    const io = corpus();
    await buildCommand([], io);
    io.fs.writeText("/work/dist/fragments/notes/a.json", "[]");
    expect(await renderCommand([], io).catch((error: unknown) => error)).toMatchObject({
      name: "FragmentError",
      message:
        "/work/dist/fragments/notes/a.json: not a fragment: an object with an id is expected",
    });
    expect(() =>
      readFragments(io.fs, "/work/dist", {
        version: 1,
        build: { tool: "0", at: "x", profile_hash: "h", sources: [] },
        entities: [],
        links: [],
        findings: [],
        candidates: { terms: [], duplicates: [] },
      }),
    ).not.toThrow();
  });
});
