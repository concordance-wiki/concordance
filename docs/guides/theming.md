# Theming

The generated site is a set of named slots rendered at build by Preact components. A project restyles it with `theme.yaml` and a stylesheet; a plugin replaces any slot with its own component. This page states the contract: the slots, their view models, how an override is declared, how the stylesheet is layered and what the budget measures. The view models are part of plugin API version `1`; a change of shape bumps it.

## Slots

| Slot | Renders | Composes |
|---|---|---|
| `Shell` | the document: `<html lang dir>`, the head assets (favicon, the mode script, stylesheets, bundles), the skip link, the body | everything |
| `Header` | the site title linking home, the logo, the search field, the navigation with counts, the mode switch | — |
| `Footer` | the version, the build instant, the project text and links, the optional credit of the tool | — |
| `Home` | the title, the statistics, the search field with shortcuts, the three entry points | — |
| `EntityPage` | badge and highlights, title, the note as an article with its legend, side panel, sources | `Neighbourhood`, `MentionsPanel` |
| `KeywordPage` | the banner, the three counts, passages by file, companions, similar forms | — |
| `MentionsPanel` | two sections, written links and recognised mentions, grouped by file; the first `initial` inline, the rest from the fragment of the entity; sorting, filtering and a collapse-all once the island runs | — |
| `Neighbourhood` | the map of the neighbourhood and its textual equivalent, the list of neighbours | — |
| `SearchResults` | the summary, the facets, the ordered results | — |
| `Index` | the letters, active or inactive, and the entries of one segment | — |
| `Todo` | documents without markdown, words without a note | — |

`renderPage(slot, props, options)` renders any slot but `Shell` as a complete page: the shell wraps the header, a `<main id="main">` holding the page, and the footer. `renderSlot(slot, props, theme)` renders one slot alone, for tests and galleries. A page component that needs a panel asks the theme for it with `useSlot("MentionsPanel")`, so that an override of the panel applies inside every page.

## View models

Every slot receives one object, typed in `@concordance-wiki/site` as `SlotProps[<slot>]`. Hrefs are relative to the page. Instants are ISO 8601 strings; components render them in `<time datetime>`. Counts are numbers.

| Slot | Props |
|---|---|
| `Shell` | `locale`, `direction` (`ltr` or `rtl`), `title`, `head: { inlineScripts?, stylesheets, modulePreloads, scripts, favicon? }`, `children` |
| `Header` | `siteTitle`, `homeHref`, `logo?: { src, alt } \| { svg }`, `navigation: { label, href, count? }[]`, `search?: { action, placeholder }` |
| `Footer` | `version`, `generatedAt`, `text?`, `links: { label, href }[]`, `credit` |
| `Home` | `title`, `search?`, `shortcuts: { label, href }[]`, `stats: { sources, files, builtAt }`, `entries: { kind: "tree" \| "index" \| "recent", title, href, items: { label, href, count?, date?, stale? }[] }[]` |
| `EntityPage` | `entity: { id, type, typeLabel, title, locale }`, `highlights: Attribute[]` (at most five shown), `sections: { id, heading?, html }[]`, `attributes: Attribute[]`, `neighbours` (the `Neighbourhood` props), `mentions` (the `MentionsPanel` props), `sources: { source, path, editHref? }[]` |
| `KeywordPage` | `entity: { id, title, locale }`, `counts: { occurrences, files, sources }`, `passages: { file: { label, href }, passages: { context, line, href }[] }[]`, `companions: { label, href?, weight }[]` (weight from 1 to 5), `similar: { label, href }[]` |
| `MentionsPanel` | `mentions: { kind: "written" \| "recognised", file: { label, href }, context, line, href, surface? }[]` (written links first, then recognised mentions, each in corpus order; `surface` is the words of the context naming the entity), `initial` (20 by default, `build.mentions_inline`), `headings?: { written, recognised }` (from the catalogue, `mentions.explicit` and `mentions.inferred`), `fragmentHref?` (the JSON fragment holding every mention of the entity) |
| `Neighbourhood` | `centre`, `neighbours: { id, label, href, typeLabel?, relation?, weight }[]` |
| `SearchResults` | `query`, `total`, `results: { title, href, typeLabel?, snippet? }[]`, `facets: { name, label, values: { value, count, href }[] }[]` |
| `Index` | `letters: { letter, href?, count }[]` (no `href`: the letter is inactive), `current?`, `entries: { label, href, glyph?, count }[]` (no `glyph`: a word without a note) |
| `Todo` | `documents: { label, href, count }[]` (files), `terms: { label, href, count }[]` (occurrences) |

An `Attribute` is `{ name, label, values: { text, href? }[] }`. The `html` of a section is the markdown already rendered by the build; a theme inserts it as is. Every list arrives in its final order; a component never sorts.

### The entity page

One template serves every type. Its order is imposed, and the default component keeps it in the markup so that a reader, a screen reader and the search index meet the same page: inside `<main>`, a `<header>` with the type badge and the first two highlighted properties on one line (`.entity-badge`), the next three on a second line (`.entity-highlights`) when the profile names that many, then the `<h1>`; right after it, the note as an `<article class="entity-body">` at full column width, one `<section id="section-…">` per heading with the rendered HTML in a `.markdown` block, closed by a `<footer class="legend">` naming the two marks of the text; then the side panel, an `<aside class="entity-panel">` holding the declared metadata as a description list, the neighbourhood, the mentions, and a `<footer class="entity-footer">` with `source: <name>/<path>` for the note and its other representations and, on the note, the "Edit in the forge" link. The stylesheet lays the article and the panels side by side on a wide screen; the DOM order never puts metadata between the title and the text.

What changes from one type to another comes from the profile only: the label of the badge, the properties `display.highlight` names (capped at five, the rest staying in the panel with every other declared attribute) and the order of the neighbours (`display.neighbours_order`, applied by the model). A test renders two entities of different types and checks that the markup differs nowhere else; another checks that no type slug appears in the default theme.

In the text, an anchor the author wrote whose target is a page of the site carries `class="written"`; an anchor the build added around a word the occurrence scan recognised carries `class="recognised"`, links to the page of the entity it names, and is drawn with a dotted underline. Both classes are exported as `WRITTEN_CLASS` and `RECOGNISED_CLASS`. The marks come from the fragment, so an override of the slot inherits them by inserting the section HTML as is; the legend is the component's, and an override that drops it leaves the two styles unexplained. A recognised word inside a written link, split by inline markup (`*entity* page`) or read in a heading that the template renders as text is left unmarked; a word several entities share, a homonym, links to the first of them in identifier order; the page's own name is never linked to itself. Images are `<img>` elements whose `src` is relative to the page for a file of the sources, copied by the build, and the URL as written for an external image, never fetched.

## White label

Everything a reader sees of the organisation comes from `theme.yaml`, validated against [`theme.schema.json`](../../packages/core/schemas/theme.schema.json); `loadTheme(fileSystem, path)` in `@concordance-wiki/site` reads it, reports a faulty key by its path the way `validate-config` does (`light.accent: value does not match the expected format`), resolves every path against the file and returns a `ResolvedThemeConfig` that the renderer consumes through `chromeOf` and `writeThemeAssets`. The build reads the file `project.theme` names in `concordance.yaml`, or `theme.yaml` next to it; a plugin theme ships one as its `tokens`. The [configuration guide](configuration.md#themeyaml) lists every key; this is what each one changes in the site.

| Key | In the site |
|---|---|
| `name` | the site title in the header, linking home, and the suffix of every `<title>` |
| `logo` | before the name in the header. An SVG is inlined, so that `currentColor` and `var(--color-accent)` inside it follow the theme; it is marked `aria-hidden` because the name follows it as text. Any other image is copied under `assets/` and linked with an empty `alt`, for the same reason |
| `favicon` | copied under `assets/` and linked with `<link rel="icon">`, the type inferred from the extension |
| `font` | the families of `--font-display`, `--font-ui` and `--font-mono`, each followed by the platform fallbacks. A name is not a download: the project ships its font files itself under `assets` and binds them with `@font-face` rules in its `stylesheet`; the default theme emits no request to any other host, and a test checks that no page or stylesheet references one |
| `radius` | `--radius`, in pixels; corners of panels, fields and badges derive from it |
| `light`, `dark` | the six colours of each scheme, `--color-bg`, `--color-surface`, `--color-border`, `--color-ink`, `--color-muted`, `--color-accent`; body text must reach 4.5:1 over `bg` and `surface`, headings 3:1 |
| `default_mode` | which palette the root carries: `system` (default) follows `prefers-color-scheme`, `light` or `dark` starts there; the reader's own choice wins in every case |
| `footer.text`, `footer.links` | a paragraph and a list of links above the build line |
| `footer.credit` | `true` shows "Built with Concordance" as a plain link to the repository, in the footer; `false`, the default, shows nothing. Nothing else in the interface names the tool: a project whose name is its own carries no visible mention of it, and a test renders the gallery with the white-label fixture and asserts it. Technical identifiers stay (the `concordance-island` element, the storage key of the mode switch): a reader never sees them |
| `stylesheet` | copied under `assets/project.css`, wrapped in the `project` layer, and linked after the tool's own stylesheet on every page |
| `assets` | a folder copied as-is under `assets/`, for fonts and icons the stylesheet references by relative URL |
| `labels` | the message overrides of the [configuration guide](configuration.md#labels) |

The fixture under `fixtures/plugins/theme-white-label` is a complete example: another name, an inline SVG logo, a blue palette, a radius of 2, a stylesheet with `@font-face` rules bound to local fonts and an icons folder, `credit: false`. `concordance gallery --theme ./fixtures/plugins/theme-white-label/index.mjs` renders every slot with it.

### Modes

`color-scheme: light dark` and the `prefers-color-scheme` query follow the system preference. The header carries a mode switch, a button cycling automatic, light and dark, which names the current scheme in words and is pressed (`aria-pressed="true"`) when the reader forced one. The choice is stored in `localStorage` under `concordance-mode` and applied as `data-mode="light"` or `data-mode="dark"` on the root element; the `tokens` layer answers that attribute with the matching palette and `color-scheme`, so that form controls and scrollbars follow. Removing the choice returns to automatic, where `default_mode` and the system preference apply.

To apply a remembered choice before the first paint, every page carries one inline script in its head, before the stylesheets: `MODE_SCRIPT` in `@concordance-wiki/site`, a constant under 300 bytes that reads the key and sets the attribute inside a `try`. It is the only inline script the site emits and never changes from one build to the next, so a content security policy can allow it by hash. The switch itself is the `mode-switch` island: served hidden, it is revealed and wired by a bundle of a few hundred bytes without any framework; without JavaScript, no dead control shows and the theme's default and the system preference apply.

### The accent carries no information on its own

`--color-accent` is used in a known set of places, and each of them carries a cue that is not a colour: links and the disclosure of the remaining mentions are underlined; the focus ring is an offset outline; a link written in a note is an underlined anchor in the accent while a recognised word is underlined with dots in the ink colour, and the legend says so in words; the banner of a keyword page and the headings of the mentions panel are text; the mode switch names the current scheme. A test lists the rules of the default stylesheets that use the accent and checks the cue of each one, so that a new use has to be added to the list with its cue. A theme author keeps the rule: whatever the accent means in a component, the same meaning is readable without it.

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

The `tokens` of a theme contribution is a `theme.yaml` like the project's; `resolveTheme` loads the one of the last theme when its loader can locate the packages (`rootOf`), and its stylesheet and assets come with it: `stylesheet` and `assets` of the contribution are read relative to the package, the `stylesheet` and `assets` the file itself names relative to the file, the file's stylesheet winning when both name one and both asset folders being copied. The project's own `theme.yaml` wins over any plugin's.

## Islands

Only interactive components are hydrated. An island is created with `island(name, Component)`: the server renders the component's markup inside `<concordance-island data-island="name" data-props="…">`, the props serialised as JSON and escaped like any attribute. A hydration entry per island reads the props back and mounts the same component with `hydrate`; `bundleIslands` produces one minified ES module per entry with esbuild, named `<name>-<hash>.js` after its content, so that two builds give the same bytes. A page loads only the bundles of the islands it contains, through `<link rel="modulepreload">` and `<script type="module" defer>`; apart from the mode script of the head, a page carries no other script.

The default theme has two islands. The mentions panel, described under [Mentions panel](#mentions-panel), whose body is served as static markup and gains its controls once it mounts. The mode switch of the header, described under [Modes](#modes), whose entry is plain JavaScript and loads no framework. Without JavaScript, everything stays readable and every link works.

## Mentions panel

The panel of an entity page answers one question: who cites this entity, and did a person write the citation or did the tool recognise it. Its anatomy, top to bottom:

- an `<aside class="mentions">` headed by the total count;
- the island, `mentions-panel`, holding two `<section class="mentions-group">`: the written links (provenance `explicit_link` or `frontmatter_ref`, headed by `mentions.explicit`), then the files that merely cite the entity (`section_mention`, `glossary_occurrence`, headed by `mentions.inferred`), each heading carrying the count of its kind;
- inside a section, one `<details class="mention-group">` per citing file, in the order of the build (source, then path), its `<summary>` giving the file path and the number of mentions in it; the first group of each section is open, the others closed. The summary holds no link, because a summary is interactive itself; each mention inside links to the passage (`line n`) on the page of the citing file and shows its context, the words naming the entity wrapped in `<mark>` when the build found them;
- the way to the mentions beyond the inline ones, when there are some: a link to the fragment of the entity in the served HTML, a button once the island runs.

The build writes `fragments/<id>.mentions.json` for every entity another note cites, holding all its mentions with hrefs relative to its page, and never a global index of mentions. What the page carries depends on the number of mentions, three regimes:

| Mentions in all | Served HTML | Once the island runs |
|---|---|---|
| up to `initial` (20, `build.mentions_inline`) | every mention, in its groups | the controls |
| more, under 200 (`MENTIONS_EMBEDDED_MAX`) | the first `initial`, a link to the fragment, and the rest inside a `<script type="application/json" id="mentions-embedded">` block next to the island | a button reveals the embedded rest without a request |
| 200 or more | the first `initial` and a link to the fragment | behind a server, a button fetches the fragment; over `file://`, where a page may not fetch, the link stands |

The island adds a `role="group"` of controls named "Mentions controls": a sort (`by file`, the build order; `by count`, the files with the most mentions first; `by line`, the files that cite earliest first), a search field filtering on the file path and the context without regard to case, with a `role="status"` line saying how many mentions are shown, and one button that collapses every group or, when all are closed, expands them all. Every control is a native element, labelled, reachable with the keyboard alone; the controls do not exist in the served HTML, so a reader without JavaScript sees the static list and its links. The exported `mentionsOf` and `mentionsPanelOf` build the view model from the model; `DEFAULT_MENTIONS_INLINE` is the default threshold.

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

`siteStylesheet` writes the first three layers to `assets/site.css`; `projectStylesheet` wraps the project's file in the fourth and writes it to `assets/project.css`, linked after the first on every page. The layer order is declared at the top of the first file, so the project's rules win whatever their specificity and whichever file loads first. `color-scheme: light dark` follows the system preference; the dark palette also applies under `data-mode="dark"` on the root, which the mode switch sets and remembers, and a `default_mode` of `light` or `dark` in `theme.yaml` starts with that palette. Properties are logical (`margin-inline`, `inset-block-start`), so a right-to-left locale needs no second stylesheet. A project overrides anything by writing plain CSS in its stylesheet; a theme plugin's `stylesheet` enters the same layer.

## Gallery

`concordance gallery [--output dir] [--theme plugin] [--config file]` renders every slot with fixture view models into a static page set, so that a theme is styled and checked without building a corpus. The output folder (`./gallery` by default) receives `index.html`, one page per slot and state, the stylesheet under `assets/site.css` and the island bundles next to it; open `index.html` in a browser. The index lists the eleven slots in order and, for each, who renders it (the default theme, or the plugin and theme that override it) and one link per state: the default state and, where meaningful, an empty one (no mention, no neighbour, no result, nothing to do), the mentions panel with more than twenty mentions so that the island is served, the home page in a right-to-left locale, the header with a logo, the footer with a project text. The chrome slots are seen on every page; the two panels are framed under a heading of their own. The pages use a neutral palette and the labels of the default theme; the stylesheet follows the system colour scheme, the switch in the header forces one, and setting `data-mode="dark"` on the root element of a page previews the dark palette without JavaScript.

The theme comes from the registry the build uses: `--theme` names a plugin package, or the path of its module when it starts with `.` or `/`, and may be repeated, the last one winning a slot; without it, the `plugins:` of `concordance.yaml` (`--config`, or the file in the current directory when it exists) apply, and without any the default theme renders alone. The `theme.yaml` of the project, named by `project.theme` or found next to the configuration, replaces the neutral palette and the fixture chrome with the project's name, logo, favicon, palette, stylesheet, footer and credit; without one, the `tokens` of the last plugin theme do the same, and the summary names the file in use. An invalid theme file stops the command with exit code 1 and one line per faulty key; a named file that does not exist, with exit code 2. A plugin loaded from a path still needs its package resolvable by name, as in a build. The fixtures are exported by `@concordance-wiki/site` as `galleryFixtures` and the page set as `galleryPages`; `buildGallery` writes the pages through any file system and returns a report with every page, its size and its accessibility findings.

The command measures every page against the budget and runs a static accessibility checker on each one, `checkAccessibility` in the site package, with no dependency: the document carries `lang`; exactly one `h1`, heading levels never skipping; every image an `alt`; every form control a label, an `aria-label`, an `aria-labelledby` or a text; a `main` landmark, once, with a `nav`, a `header` and a `footer`; every link a name; unique `id`s; the first focusable element a skip link to an existing fragment; and the four ARIA rules listed under [Accessibility](#accessibility). A page over budget or a finding fails the command with exit code 1 and one line per problem on stderr. The command also runs `checkContrast` on the palette of the stylesheet and prints one `warning: contrast:` line per pair of colours under its minimum ratio; a warning does not fail the command. The site tests run the checker on every gallery page of the default theme, and continuous integration builds the gallery into `reports/gallery` and publishes it as the `gallery` artifact of every run.

## Accessibility

The default theme is built so that a screen reader or keyboard user reaches the same information as everyone else, and the tests hold it to five guarantees. A theme that overrides a slot inherits them only if it keeps what they rest on; this section says what that is.

**Contrast.** `contrastRatio(a, b)` and `relativeLuminance(colour)` implement the WCAG definitions; `contrastPairs(theme)` lists, for both schemes of a `theme.yaml`, the pairs the default stylesheet draws: `ink`, `muted` and `accent` text over `bg` and over `surface`, each with the minimum of its use, 4.5:1 for body, muted and link text, 3:1 for headings and the focus ring (`CONTRAST_MINIMUMS`). `checkContrast(theme)` returns the pairs under their minimum; the gallery prints them as warnings and the site build will. The brand palette passes every pair; its light accent is `#B84820` rather than the `#C24E24` of the mark because links are drawn in accent over the page background, where the mark's colour reached 4.37:1 only. A theme author changing a colour runs `concordance gallery` and reads the `contrast:` lines; borders are decorative and not checked, a control being identified by its label, not by its outline.

**Focus and keyboard.** Every interactive element (`a`, `button`, `input`, `select`, `textarea`, `summary`, anything with `tabindex`) shows the same `:focus-visible` ring in the base layer, a 3 px outline in `--color-accent` offset by 2 px; no rule of the shipped stylesheets removes an outline, and a project stylesheet must not either without drawing an equivalent. The skip link is the first element of the body and appears on focus. The tab order is the document order: the default theme sets no positive `tabindex` and no inline handler, and each page reads skip link, header, main, footer. The file groups of the mentions panel are native `details` elements with a named `summary`; the mentions beyond the inline threshold are reachable through a plain link to their fragment before hydration and through a real `button` after it.

**Textual equivalents.** Every graphical view ships the same information as structured text in the served HTML, where the search index reads it. The neighbourhood renders a `<figure>` holding a star map (an SVG hidden from assistive technologies, integer coordinates so that two builds give the same bytes) and a `<figcaption>`, then the `<ul id="neighbourhood-list">` of neighbours with their type, relation and weight; the figure points at the list with `aria-describedby`, and the list is authoritative. A theme drawing its own map keeps the list.

**ARIA roles and states.** The controls of the mentions island form a named `role="group"` and its filter count is a `role="status"` line; every `<details>` of the panel starts with a named `<summary>` and holds no nested interactive element; the two search forms are `role="search"` landmarks with distinct names; a tab strip, when a theme adds one, uses `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, and `role="tabpanel"` labelled by its tab. The static checker enforces these patterns on every page with four rules next to the nine structural ones: `aria-expanded-on-toggles` (a button or summary with `aria-controls` states `aria-expanded`, `true` or `false`, and controls an existing id), `details-summary` (a `details` starts with a named `summary`), `tab-roles` (tabs inside a tablist, each with a state and a panel labelled by it, no orphan panel), `focusable-has-visible-name` (a focusable element whose visible content is hidden from assistive technologies, an icon typically, exposes a name through `aria-label`, an SVG `<title>`, an image alternative, a `title` or a label).

**Automated audit.** The site tests run axe-core over every page of the gallery, the index included, in a DOM without a layout engine (`happy-dom`), and fail on any violation of impact serious or critical; the default theme currently has none of any impact. The rules that need layout, `color-contrast`, `color-contrast-enhanced` and `link-in-text-block`, are disabled there and covered by the contrast test, which reads the palette the stylesheet declares. A theme author runs the same suite on an overriding component by adding it to the gallery fixtures of a test.

## Budget

`measureBudget(pages, islands, { maxPageBytes })` compares every page with the budget, 150 kB excluding previews, and lists the pages over it. Its summary gives one line per island (`island mentions-panel: 12.0 kB`), the number of pages with the largest one, and one line per page over budget; the build prints it and continuous integration fails on any page over budget.
