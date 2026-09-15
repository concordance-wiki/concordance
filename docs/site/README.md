# Organisation home page

`index.html` is the home page of the organisation site, written by hand: one HTML document with its stylesheet inline, a light and a dark palette, and a single inline script that drives the before/after slider of the showcase. It carries no functional content of the wiki; it points at the repositories, the guides and the demo.

`.github/workflows/pages.yml` publishes the folder on GitHub Pages at the root of the project site once the `ci` workflow has passed on `main` (and on manual dispatch), with the component gallery of the default theme rendered under `gallery/` next to it. The page is kept here until the organisation site repository exists; it then moves there unchanged. `scripts/validate.mjs` checks that it stays a single well-formed document whose links are absolute.
