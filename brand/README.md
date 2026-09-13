# Concordance brand

The mark reproduces a printed concordance: lines of context of unequal length, aligned on the column where the searched word repeats.

## Files

| File | Use |
|---|---|
| `concordance-mark.svg` | main mark, three lines, every size |
| `concordance-mark-mono.svg` | ink only, imposed backgrounds and print |
| `concordance-mark-light.svg` | dark backgrounds |
| `concordance-mark-white.svg` | pure white, photo or accent backgrounds |
| `favicon.svg` | favicon, switches between light and dark automatically |
| `avatar-github.svg` | organisation avatar, 460 px, margin for the circular crop |
| `concordance-header.svg` | five-line variant, README and documentation headers only |
| `theme.yaml` | brand tokens, in the format of `schemas/theme.schema.json`: the palettes of the default theme of the site; its `logo` and `favicon` paths are relative to this folder, and the site inlines the mark |

## Rules

The mark is built on a 48 unit grid. Do not redraw it, do not add a shadow, gradient or outline. The accent column is always vertical and centred; the lines keep unequal lengths.

Horizontal lock-up: mark then word, with a gap equal to half the mark height. Instrument Serif for the showcase page, Instrument Sans 600 for the interface, whose text and headings share that one family; IBM Plex Mono for paths and identifiers.

The five-line variant clogs below 24 px: it is for large formats only.

The accent of `theme.yaml` in light mode, `#A8431C`, is darker than the column of the mark, `#C24E24`: links are drawn in accent over the page background and must reach 4.5:1 there, which the mark's colour does not. The mark keeps its colour; a graphic is not text.

Minimum mark size: 16 px. Clear space: a quarter of the height.
