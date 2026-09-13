# Theme reference

Every key of `theme.yaml`, generated from [`theme.schema.json`](../../packages/core/schemas/theme.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/theming.md) explains how the keys work together.

Schema of theme.yaml.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `name` (required) | string | — | non-empty | Name of the site, in the header and in the title of every page. |
| `logo` | string | — | — | Path of the logo shown before the name in the header, relative to this file; an SVG is inlined so that it can follow the current colour. |
| `favicon` | string | — | — | Path of the favicon, relative to this file; copied under assets/. |
| `font` | object | — | — | Font families by role. A project ships the font files itself, under assets, with @font-face rules in its stylesheet: the site never loads a font from a third-party host. See [`font`](#font). |
| `radius` | integer | `8` | at least 0 | Corner radius of surfaces and controls, in pixels. |
| `light` (required) | object | — | — | Palette of the light mode, six required #RRGGBB colours and three optional ones. Text must reach a 4.5:1 contrast over bg, surface and soft, headings 3:1; the build reports the pairs below. See [`light`](#light). |
| `dark` (required) | object | — | — | Palette of the dark mode, the same colours as light, with the same contrast requirements: a second palette, never an inversion of the first. See [`dark`](#dark). |
| `default_mode` | enum | `"system"` | `light`, `dark`, `system` | Palette the site starts with; the reader's own choice, remembered by the mode switch, wins. |
| `footer` | object | — | — | The footer of every page. See [`footer`](#footer). |
| `stylesheet` | string | — | — | Path of a stylesheet loaded after the tool's own, in the project cascade layer, relative to this file. |
| `assets` | string | — | — | Path of a folder copied as-is under assets/ of the site (fonts, icons), relative to this file. |
| `labels` | map of map of string | — | keys: `en`, `fr` | Interface labels to override, by language of a shipped catalogue then by message identifier. A value is an ICU MessageFormat message that must use exactly the variables of the source message; the build refuses an unknown identifier, a syntax error or a different set of variables. |

## `font`

Font families by role. A project ships the font files itself, under assets, with @font-face rules in its stylesheet: the site never loads a font from a third-party host.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `display` | string | — | — | Family of the headings; the platform fonts when absent. |
| `ui` | string | — | — | Family of the interface text; the platform fonts when absent. |
| `mono` | string | — | — | Family of code and identifiers; the platform fonts when absent. |

## `light`

Palette of the light mode, six required #RRGGBB colours and three optional ones. Text must reach a 4.5:1 contrast over bg, surface and soft, headings 3:1; the build reports the pairs below.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `bg` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the page. |
| `surface` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the header, the cards and the panels. |
| `border` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Borders and separators. |
| `ink` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Colour of the text. |
| `muted` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Secondary text: labels, counts, metadata. |
| `accent` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Accent of links, focus rings and the current position; never a status, a decoration or the only carrier of an information. |
| `label` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | The lightest text: the labels of the panels, counts and notes; muted when absent. Must reach 4.5:1 over bg, surface and soft. |
| `soft` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the fields, the chips and the current entry of the tree, between bg and surface; bg when absent. |
| `highlight` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of a marked passage, the searched word in a result for instance, read in ink; border when absent. |

## `dark`

Palette of the dark mode, the same colours as light, with the same contrast requirements: a second palette, never an inversion of the first.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `bg` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the page. |
| `surface` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the header, the cards and the panels. |
| `border` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Borders and separators. |
| `ink` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Colour of the text. |
| `muted` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Secondary text: labels, counts, metadata. |
| `accent` (required) | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Accent of links, focus rings and the current position; never a status, a decoration or the only carrier of an information. |
| `label` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | The lightest text: the labels of the panels, counts and notes; muted when absent. Must reach 4.5:1 over bg, surface and soft. |
| `soft` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of the fields, the chips and the current entry of the tree, between bg and surface; bg when absent. |
| `highlight` | string | — | pattern `^#[0-9A-Fa-f]{6}$` | Background of a marked passage, the searched word in a result for instance, read in ink; border when absent. |

## `footer`

The footer of every page.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `text` | string | — | — | A paragraph shown in the footer. |
| `links` | object[] | — | — | Links shown in the footer, in order. See [`footer.links[]`](#footerlinks). |
| `credit` | boolean | `false` | — | Whether the footer credits the tool with a discreet link to its repository; nothing else in the interface names it. |

### `footer.links[]`

Links shown in the footer, in order.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `label` (required) | string | — | — | Text of the link. |
| `url` (required) | string | — | — | Destination of the link. |
