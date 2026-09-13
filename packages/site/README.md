# @concordance-wiki/site

Site generation: the slots of the site and their view models, the default theme, the islands and their bundles, the stylesheet and the page budget. The search index and the message catalogues come later.

Today: `SLOT_NAMES` and `SlotProps` name the eleven slots and type what each receives; `defaultComponents` implements every slot in Preact, rendered to static HTML by `renderPage` (a complete document) and `renderSlot` (one slot); `useSlot` lets a page compose the panels of the current theme; `resolveTheme` starts from the default theme and applies the `components` of every `theme` contribution of the plugin registry, the last one winning, and loads the `tokens` of the last theme when it can locate the package, with `importThemeModule` loading a component by its path relative to the plugin package and `packageDirectoryOf` finding that package; `island` wraps an interactive component so that its props travel in the page, `mountIslands` hydrates them in the browser and `bundleIslands` builds one hashed, minified module per island with esbuild, byte-identical from one build to the next; `loadTheme` reads and validates a `theme.yaml`, resolving its logo, favicon, stylesheet and assets against the file, `chromeOf` turns it into the title, logo, favicon, stylesheets and footer of every page and `writeThemeAssets` writes its files under `assets/`; `tokensStylesheet` turns the theme into custom properties, `siteStylesheet` assembles the `tokens, base, components` layers and `projectStylesheet` wraps the project's file in the `project` layer, declared last; `MODE_SCRIPT` is the one inline script of a page, applying the colour scheme a reader chose with the `mode-switch` island before the first paint; `measureBudget` reports the pages over 150 kB and the size of each island; `galleryFixtures`, `galleryPages`, `galleryDocuments` and `buildGallery` render every slot with representative data into the static page set of `concordance gallery`; `checkAccessibility` runs thirteen structural and ARIA accessibility rules on any page without a browser, and `checkContrast` reports the text and background pairs of a `theme.yaml` under 4.5:1 for body text or 3:1 for headings, from `contrastRatio` and `relativeLuminance`.

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
