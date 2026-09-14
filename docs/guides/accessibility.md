# Accessibility: what is verified, and how

The default theme is held to six guarantees, each enforced by a test file under `packages/site/test/accessibility/` and by the `concordance gallery` command, so that the public site stays conformant without a manual audit. This guide says, for each guarantee, what is verified, which test enforces it, and what a theme author who overrides a slot or a colour must keep. The [theming guide](theming.md#accessibility) describes the mechanisms themselves; the [command line guide](command-line.md) says what the gallery command reports.

The tests render every page of the component gallery through the default theme, the type pages and the index included, and read the shipped stylesheets rule by rule. They run with the site tests (`pnpm test`) and in continuous integration; the gallery command runs the static checker and the contrast measure on every page it writes and fails on any finding.

## Contrasts

**Verified.** Every text and background pair the stylesheet draws, in both schemes of two palettes: the default theme's (`brand/theme.yaml`) and the palette of a project publishing its own documentation with Concordance (`project-theme.yaml` next to the test). Body, secondary, label and link text over the page, the surface and the soft ground, and the ink over the highlight of a marked passage: nothing under 4.5:1. Five reference ratios of each palette are pinned in both schemes (ink on the page, secondary text on the page, label on a surface, accent on the page, ink on the highlight), so that a change of colour is a change of a number in the test; the default light palette's lowest pair is the label on the page at 4.52:1, the project palette's the accent on the soft ground at 4.63:1.

**Test.** `contrast.test.ts`, on `checkContrast` and `contrastPairs` of the site package.

**A theme author keeps** every pair of `checkContrast(theme)` at or above its minimum: `concordance gallery` prints one `warning: contrast:` line per pair under it. The accent is the tightest colour, read as link text over the page and the soft ground; a warmer accent than the default's needs a darker value.

## Colour never carries information alone

**Verified.** A word without a note in the text is a dashed underline in the label grey, its anchor carrying a `title` ("7 passages, no note") and the same words as hidden text; a word with a note is dotted, titled "note: …". The current page of the tree is a rule on its side and the bold weight on a `span` carrying `aria-current="page"`, never a link; the last step of the breadcrumb, the entry of the contents being read (`aria-current="location"`), the letter of the index, the page of a list and the tab shown (`aria-selected`) each carry a rule, a fill or the weight with their state. A cited related page reads "Cited ·" before its excerpt. The freshness alert is worded: a card on the home page, and on the spaces page the date of a dormant space in days with a hidden phrase after it, "past the freshness threshold", the accent being the only colour that carries an alert. The chip of a word without a note on a space page is dashed, titled and worded the same way. Every rule of the stylesheet that draws the accent is listed in the test.

**Test.** `colour.test.ts`, on the rendered gallery states and the stylesheet rules.

**A theme author keeps** the `aria-current` and `aria-selected` attributes, the `title` and the hidden text of the marks, the "Cited" word, the wording of the alerts; a component may draw them otherwise, never by a colour alone.

## Targets of 40 px

**Verified.** Every interactive selector of the shipped stylesheets, listed explicitly in the test by region of the page (the bar, the drawer, the tree, the live results, the panel, each page, the documents), is guaranteed 40 px of height at every width, read from its rules: its declared minimum or fixed block size, else the 40 px the base layer gives every button, field, select and summary, else its vertical padding plus the lines of text it holds at the smallest line of the theme, 13 px at the line height of the page. A rule of a wider width that resizes a target keeps it at 40 px. The box of a checkbox is 16 px and its label takes the row and the height. The targets of the phone stay at 48 px.

**Test.** `targets.test.ts`, on `baseStylesheet` and `componentsStylesheet`.

**A theme author keeps** `min-block-size: 2.5rem` (or more) on every control and link of the chrome, the trees, the filters, the tabs and the lists; a new interactive selector is added to the list of the test. Links inside a line of text, a recognised word, the type chip of a title line, the position of a passage, are inline and not held to the size.

## Text first

**Verified.** On every page of the gallery with the scripts removed and the islands left as served: the title and the text stand outside any island; no button is served visible, every link has a real target, no inline handler; every island of the main content serves the markup a reader gets before hydration (the viewer of a document, opened on demand, is the one exception, the page reading the file through its extracted text or its link); a marker names the main content of every state (the note, the passages, the rows, the entries). Twenty related pages at most are served inline, a plain link to their fragment standing for the others before hydration; the passages of a keyword page beyond the two in view fold behind native disclosures.

**Test.** `text-first.test.ts`.

**A theme author keeps** the text of a page in the served markup, controls that need a script hidden until it runs, and disclosures as `details` elements; a new gallery state names its content marker in the test.

## Headings, focus and keyboard

**Verified.** One `h1` per page inside the main landmark and no heading level skipped; the table of contents lists exactly the `h2` sections of the note, in order, each entry pointing at its section. The skip link is the first focusable element and points at the main landmark, shown on focus. One `:focus-visible` rule, a 3 px ring in the accent offset by 2 px, on links, buttons, fields, selects, text areas, summaries and anything with a `tabindex`; no rule removes an outline. No `tabindex` and no inline handler in the served markup; every page reads skip link, header, main, footer, the bar in the phone's order; the rules that move an element by `order` are listed, markers and the bar of the wider widths, so that the focus order stays the reading order of the served markup. Every keyboard shortcut has a clickable equivalent: `/` and the search field itself or the search button of the narrow bar; `Escape` and the clear button beside the field; the arrow keys of the live results and their rows, each a link; the arrows of a row of tabs and the tabs themselves, each a link to its panel that works before any script; every disclosure a native `details` element opened by pointer or keyboard alike.

**Test.** `headings.test.ts`.

**A theme author keeps** one `h1`, the section ids the contents point at, the skip link first, the focus rule of the base layer, no positive `tabindex`, and a control for every shortcut.

## Audit on every gallery state

**Verified.** Every state file under `src/gallery/states/` is listed in `galleryPages`, one page per file named after it; the static checker (`checkAccessibility`, thirteen structural and ARIA rules) and the contrast measure pass on every document the gallery command writes, the type pages and the index included, and the command reports no problem; the automated audit (axe-core, in a DOM) runs over every state and the index in the site tests and fails on any violation.

**Test.** `audit.test.ts`, with `test/a11y/axe.test.ts` for the automated audit.

**A theme author keeps** the gallery green: `concordance gallery` after any change, 0 accessibility findings and 0 contrast pairs; a new state or an overriding component is added to the gallery so that every check runs over it.

## Two points left open

The reference design of the default theme left two points to observation, noted in the screen notes of the entity page and the spaces page: the panel of related pages beyond two hundred passages (the page then embeds nothing and the island fetches the fragment; whether the list stays readable at that size is to be seen on a real corpus), and the length of space labels in the bar and the drawer, cut with an ellipsis today.
