# @concordance-wiki/site

Site generation: the slots of the site and their view models, the default theme, the islands and their bundles, the stylesheet and the page budget. The search index and the message catalogues come later.

Today: `SLOT_NAMES` and `SlotProps` name the eleven slots and type what each receives; `defaultComponents` implements every slot in Preact, rendered to static HTML by `renderPage` (a complete document) and `renderSlot` (one slot); `useSlot` lets a page compose the panels of the current theme; `resolveTheme` starts from the default theme and applies the `components` of every `theme` contribution of the plugin registry, the last one winning, with `importThemeModule` loading a component by its path relative to the plugin package; `island` wraps an interactive component so that its props travel in the page, `mountIslands` hydrates them in the browser and `bundleIslands` builds one hashed, minified module per island with esbuild, byte-identical from one build to the next; `tokensStylesheet` turns a `theme.yaml` into custom properties and `siteStylesheet` assembles the `tokens, base, components, project` layers; `measureBudget` reports the pages over 150 kB and the size of each island; `galleryFixtures`, `galleryPages`, `galleryDocuments` and `buildGallery` render every slot with representative data into the static page set of `concordance gallery`; `checkAccessibility` runs thirteen structural and ARIA accessibility rules on any page without a browser, and `checkContrast` reports the text and background pairs of a `theme.yaml` under 4.5:1 for body text or 3:1 for headings, from `contrastRatio` and `relativeLuminance`.

## Dependencies

| Package | Why |
|---|---|
| `preact` | the component model of the site: small enough to hydrate an island without a framework runtime worth mentioning, with a JSX runtime the TypeScript compiler targets directly |
| `preact-render-to-string` | renders the components to static HTML at build; the published pages need no JavaScript to be read |
| `esbuild` | bundles and minifies one module per island with content-hashed names; deterministic output, no configuration file |

Development only:

| Package | Why |
|---|---|
| `axe-core` | the accessibility audit the tests run over every gallery page; the reference engine, whose rule identifiers the documentation cites |
| `happy-dom` | the DOM axe-core needs, as a Vitest environment; no layout engine, so the contrast rules are disabled there and the palette is checked by numbers instead |

See the [theming guide](../../docs/guides/theming.md). Part of [Concordance](../../README.md).
