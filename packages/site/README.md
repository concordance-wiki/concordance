# @concordance-wiki/site

Site generation: the slots of the site and their view models, the default theme, the islands and their bundles, the stylesheet and the page budget. The search index and the message catalogues come later.

Today: `SLOT_NAMES` and `SlotProps` name the eleven slots and type what each receives; `defaultComponents` implements every slot in Preact, rendered to static HTML by `renderPage` (a complete document) and `renderSlot` (one slot); `useSlot` lets a page compose the panels of the current theme; `resolveTheme` starts from the default theme and applies the `components` of every `theme` contribution of the plugin registry, the last one winning, with `importThemeModule` loading a component by its path relative to the plugin package; `island` wraps an interactive component so that its props travel in the page, `mountIslands` hydrates them in the browser and `bundleIslands` builds one hashed, minified module per island with esbuild, byte-identical from one build to the next; `tokensStylesheet` turns a `theme.yaml` into custom properties and `siteStylesheet` assembles the `tokens, base, components, project` layers; `measureBudget` reports the pages over 150 kB and the size of each island.

## Dependencies

| Package | Why |
|---|---|
| `preact` | the component model of the site: small enough to hydrate an island without a framework runtime worth mentioning, with a JSX runtime the TypeScript compiler targets directly |
| `preact-render-to-string` | renders the components to static HTML at build; the published pages need no JavaScript to be read |
| `esbuild` | bundles and minifies one module per island with content-hashed names; deterministic output, no configuration file |

See the [theming guide](../../docs/guides/theming.md). Part of [Concordance](../../README.md).
