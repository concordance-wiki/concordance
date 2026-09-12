# Theming

The generated site is a set of named slots rendered at build by Preact components. A project restyles it with `theme.yaml` and a stylesheet; a plugin replaces any slot with its own component. This page states the contract: the slots, their view models, how an override is declared, how the stylesheet is layered and what the budget measures. The view models are part of plugin API version `1`; a change of shape bumps it.

## Slots

| Slot | Renders | Composes |
|---|---|---|
| `Shell` | the document: `<html lang dir>`, the head assets, the skip link, the body | everything |
| `Header` | the site title linking home, the logo, the search field, the navigation with counts | — |
| `Footer` | the version, the build instant, the project text and links, the optional mention of the tool | — |
| `Home` | the title, the statistics, the search field with shortcuts, the three entry points | — |
| `EntityPage` | badge and highlights, title, rendered markdown, side panel, sources | `Neighbourhood`, `MentionsPanel` |
| `KeywordPage` | the banner, the three counts, passages by file, companions, similar forms | — |
| `MentionsPanel` | written links and recognised mentions, the first `initial` inline, the rest in an island | — |
| `Neighbourhood` | the textual neighbourhood, the equivalent of the mini-map | — |
| `SearchResults` | the summary, the facets, the ordered results | — |
| `Index` | the letters, active or inactive, and the entries of one segment | — |
| `Todo` | documents without markdown, words without a note | — |

`renderPage(slot, props, options)` renders any slot but `Shell` as a complete page: the shell wraps the header, a `<main id="main">` holding the page, and the footer. `renderSlot(slot, props, theme)` renders one slot alone, for tests and galleries. A page component that needs a panel asks the theme for it with `useSlot("MentionsPanel")`, so that an override of the panel applies inside every page.

## View models

Every slot receives one object, typed in `@concordance-wiki/site` as `SlotProps[<slot>]`. Hrefs are relative to the page. Instants are ISO 8601 strings; components render them in `<time datetime>`. Counts are numbers.

| Slot | Props |
|---|---|
| `Shell` | `locale`, `direction` (`ltr` or `rtl`), `title`, `head: { stylesheets, modulePreloads, scripts }`, `children` |
| `Header` | `siteTitle`, `homeHref`, `logo?: { src, alt }`, `navigation: { label, href, count? }[]`, `search?: { action, placeholder }` |
| `Footer` | `version`, `generatedAt`, `text?`, `links: { label, href }[]`, `mentionTool` |
| `Home` | `title`, `search?`, `shortcuts: { label, href }[]`, `stats: { sources, files, builtAt }`, `entries: { kind: "tree" \| "index" \| "recent", title, href, items: { label, href, count?, date?, stale? }[] }[]` |
| `EntityPage` | `entity: { id, type, typeLabel, title, locale }`, `highlights: Attribute[]` (at most five shown), `sections: { id, heading?, html }[]`, `attributes: Attribute[]`, `neighbours` (the `Neighbourhood` props), `mentions` (the `MentionsPanel` props), `sources: { path, editHref? }[]` |
| `KeywordPage` | `entity: { id, title, locale }`, `counts: { occurrences, files, sources }`, `passages: { file: { label, href }, passages: { context, line, href }[] }[]`, `companions: { label, href?, weight }[]` (weight from 1 to 5), `similar: { label, href }[]` |
| `MentionsPanel` | `mentions: { kind: "written" \| "recognised", file: { label, href }, context, line, href }[]`, `initial` (20 by default, `build.mentions_inline`) |
| `Neighbourhood` | `centre`, `neighbours: { id, label, href, typeLabel?, relation?, weight }[]` |
| `SearchResults` | `query`, `total`, `results: { title, href, typeLabel?, snippet? }[]`, `facets: { name, label, values: { value, count, href }[] }[]` |
| `Index` | `letters: { letter, href?, count }[]` (no `href`: the letter is inactive), `current?`, `entries: { label, href, glyph?, count }[]` (no `glyph`: a word without a note) |
| `Todo` | `documents: { label, href, count }[]` (files), `terms: { label, href, count }[]` (occurrences) |

An `Attribute` is `{ name, label, values: { text, href? }[] }`. The `html` of a section is the markdown already rendered by the build; a theme inserts it as is. Every list arrives in its final order; a component never sorts.

## Overriding a slot from a plugin

A plugin's `theme` contribution names, under `components`, the slot and the path of a module whose default export is a Preact component receiving the props above. Slots the theme leaves out come from the default theme; when several plugins override the same slot, the last one declared in `concordance.yaml` wins. The build summary lists every overridden slot with the plugin and theme that provide it.

```js
export default definePlugin({
  name: "@example/plugin-theme-corporate",
  version: "0.1.0",
  apiVersion: "1",
  contributes: {
    themes: [{ name: "corporate", tokens: "./theme.yaml", components: { Footer: "./footer.js" } }],
  },
});
```

```js
// footer.js
import { h } from "preact";

export default function Footer({ version, generatedAt }) {
  return h("footer", { class: "site-footer" }, `version ${version}, built on ${generatedAt}`);
}
```

A component may be written in TSX and compiled by the plugin; the site only needs a function. The default components are semantic HTML without inline styles: landmarks (`header`, `nav`, `main`, `aside`, `footer`), one `h1` per page and headings in order, a skip link to `#main`, `lang` and `dir` on the document. An override keeps those properties so that the accessibility audit still passes. The fixture under `fixtures/plugins/theme-example` overrides the footer and is rendered by the site tests; the [plugins guide](plugins.md) shows the manifest.

## Islands

Only interactive components are hydrated. An island is created with `island(name, Component)`: the server renders the component's markup inside `<concordance-island data-island="name" data-props="…">`, the props serialised as JSON and escaped like any attribute. A hydration entry per island reads the props back and mounts the same component with `hydrate`; `bundleIslands` produces one minified ES module per entry with esbuild, named `<name>-<hash>.js` after its content, so that two builds give the same bytes. A page loads only the bundles of the islands it contains, through `<link rel="modulepreload">` and `<script type="module" defer>`; a page without an island carries no script at all.

The mentions panel is the only island of the default theme: the first `initial` mentions are static, and the remaining ones are rendered inside a `<details>` element that the island replaces with a button once it mounts. Without JavaScript, everything stays readable and every link works.

## Stylesheet

The site ships one stylesheet in four cascade layers, declared first so that their order never depends on the source order:

```css
@layer tokens, base, components, project;
```

| Layer | Content |
|---|---|
| `tokens` | custom properties generated from `theme.yaml`: `--font-display`, `--font-ui`, `--font-mono`, `--radius`, `--space-1` to `--space-6`, `--measure`, and the six colours `--color-bg`, `--color-surface`, `--color-border`, `--color-ink`, `--color-muted`, `--color-accent` |
| `base` | document defaults: typography, links, tables, focus ring, skip link, `prefers-reduced-motion` |
| `components` | one block per slot of the default theme, selected by class names |
| `project` | the content of the project's `stylesheet:`, which wins every cascade by construction |

`color-scheme: light dark` follows the system preference; the dark palette also applies under `data-mode="dark"` on the root, which the mode switch sets and remembers, and a `default_mode` of `light` or `dark` in `theme.yaml` starts with that palette. Properties are logical (`margin-inline`, `inset-block-start`), so a right-to-left locale needs no second stylesheet. A project overrides anything by writing plain CSS in its stylesheet; a theme plugin's `stylesheet` enters the same layer.

## Gallery

`concordance gallery [--output dir] [--theme plugin] [--config file]` renders every slot with fixture view models into a static page set, so that a theme is styled and checked without building a corpus. The output folder (`./gallery` by default) receives `index.html`, one page per slot and state, the stylesheet under `assets/site.css` and the island bundles next to it; open `index.html` in a browser. The index lists the eleven slots in order and, for each, who renders it (the default theme, or the plugin and theme that override it) and one link per state: the default state and, where meaningful, an empty one (no mention, no neighbour, no result, nothing to do), the mentions panel with more than twenty mentions so that the island is served, the home page in a right-to-left locale, the header with a logo, the footer with a project text. The chrome slots are seen on every page; the two panels are framed under a heading of their own. The pages use a neutral palette and the labels of the default theme; the stylesheet follows the system colour scheme, and setting `data-mode="dark"` on the root element of a page previews the dark palette.

The theme comes from the registry the build uses: `--theme` names a plugin package, or the path of its module when it starts with `.` or `/`, and may be repeated, the last one winning a slot; without it, the `plugins:` of `concordance.yaml` (`--config`, or the file in the current directory when it exists) apply, and without any the default theme renders alone. A plugin loaded from a path still needs its package resolvable by name, as in a build. The fixtures are exported by `@concordance-wiki/site` as `galleryFixtures` and the page set as `galleryPages`; `buildGallery` writes the pages through any file system and returns a report with every page, its size and its accessibility findings.

The command measures every page against the budget and runs a static accessibility checker on each one, `checkAccessibility` in the site package, with no dependency: the document carries `lang`; exactly one `h1`, heading levels never skipping; every image an `alt`; every form control a label, an `aria-label`, an `aria-labelledby` or a text; a `main` landmark, once, with a `nav`, a `header` and a `footer`; every link a name; unique `id`s; the first focusable element a skip link to an existing fragment. A page over budget or a finding fails the command with exit code 1 and one line per problem on stderr. The site tests run the checker on every gallery page of the default theme, and continuous integration builds the gallery into `reports/gallery` and publishes it as the `gallery` artifact of every run. The accessibility story adds what a static check cannot see, contrast, focus and ARIA states, on top of these rules.

## Budget

`measureBudget(pages, islands, { maxPageBytes })` compares every page with the budget, 150 kB excluding previews, and lists the pages over it. Its summary gives one line per island (`island mentions-panel: 12.0 kB`), the number of pages with the largest one, and one line per page over budget; the build prints it and continuous integration fails on any page over budget.
