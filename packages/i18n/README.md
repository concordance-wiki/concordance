# @concordance-wiki/i18n

The message catalogues of the generated site, `en` and `fr`, in ICU MessageFormat, typed by identifier and resolved at build time so that the published pages carry final strings and no formatting library. Installed by `@concordance-wiki/cli`; you need it only to build on the engine, to word a theme component from a plugin for instance.

## Install

```bash
npm install @concordance-wiki/i18n
```

## Use

```ts
import { formatMessage, loadCatalogue, textDirection } from "@concordance-wiki/i18n";

const catalogue = loadCatalogue("fr-CA");
formatMessage(catalogue, "entity.mentionsCount", { count: 2 }); // "2 mentions"
formatMessage(catalogue, "site.generatedAt", { date: new Date("2026-03-05T00:00:00Z") }); // "Généré le 5 mars 2026"
textDirection(catalogue.locale); // "ltr", for the dir attribute of the page
```

An unknown identifier, a missing variable or an extra one does not compile: `MessageId` is the union of every key of the catalogue and `MessageArguments` derives the argument types from the declared kinds.

## What it contains

- `loadCatalogue`, `formatMessage`, `formatText`, `resolveLanguage`, `CatalogueError`: the catalogue of a locale, picked by language subtag with fallback to the source language, and the messages resolved with the plural rules, number and date formats of the locale.
- `validateLabels`, `validateOverride`, `validateOverrides`: the `labels` block of `theme.yaml` checked before any rendering.
- `formatDate`, `formatDay`, `formatMonth`, `formatMonthName`, `formatNumber`, `formatRelative`, `textDirection`: the platform `Intl` formatters for the values rendered outside a message.
- `messageIds`, `messageArguments`, `argumentNames`, `parseMessage`, `argumentsOf`: the identifiers, the declared kinds and the ICU parser, for the tests of a theme.
- `SOURCE_LANGUAGE`, `shippedLanguages`: `en`, and the languages that ship a complete catalogue.

## Documentation

- [Theming](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/theming.md), the `labels` block of a theme
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), `project.locale`
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/i18n/CHANGELOG.md)

## Inside

Every label of the site comes from a catalogue per language in ICU MessageFormat, stored as the JSON translation platforms exchange, one file per area of the site under `messages/<language>/`: an area is an identifier prefix (`home`, `entity`, `search`, `results`, `spaces`...), `messages/en/<area>.json` is its source, `{ "<id>": { "defaultMessage": "...", "description": "..." } }`, and `messages/<language>/<area>.json` its flat translation, `{ "<id>": "..." }`. Every key of a file is under the prefix the file is named after, and the keys are sorted. `en` and `fr` ship complete; a test checks that every locale carries every key of the source with the same variables and kinds.

Each area has a module under `src/areas/<area>.ts` that imports its two files and declares the ICU kind of every argument of every message of the area (`{ count: "plural" }`, `{}` for a message without any), checked by `satisfies` against the keys of the source file. `src/areas.ts` lists the areas in the order of their prefixes; the catalogue merges them in that order, so the identifiers read in sorted order. Identifiers are typed from that merge (`MessageId` is the union of the keys of every area), and `MessageArguments` derives the argument types from the declared kinds: an unknown identifier, a missing variable or an extra one does not compile. A unit test keeps the declared kinds aligned with what the ICU parser reads in the catalogue, and computes the number of messages from the files rather than pinning it.

### Adding an area

A new page or part of the site gets its own prefix and its own files: `messages/en/<area>.json`, `messages/fr/<area>.json`, `src/areas/<area>.ts` declaring the arguments, and one line in the `AREAS` list of `src/areas.ts` at the place of its prefix. The tests reject a file whose keys leave the prefix or are unsorted, a module whose declared kinds differ from the parsed messages, and an area listed out of order.

### Resolution

`loadCatalogue` picks the shipped catalogue by language subtag (`fr-CA` uses `fr` and formats numbers, dates and plurals with `fr-CA`) and falls back to the source language when a language ships no catalogue (`de` gets the `en` messages formatted in `en`, with `catalogue.fallback` set). A malformed tag raises a `CatalogueError`. Dates inside messages are formatted in UTC unless `timeZone` says otherwise, so that two builds of the same corpus agree.

`formatDate`, `formatNumber` and `formatRelative` wrap `Intl.DateTimeFormat`, `Intl.NumberFormat` and `Intl.RelativeTimeFormat` for the values rendered outside a message; `formatRelative` picks the largest unit that fits and lets the platform say "yesterday" or "hier". `textDirection` reads the text information of `Intl.Locale` (`getTextInfo()` on engines that have it, the earlier `textInfo` accessor otherwise) and falls back to the likely script of the locale against a list of right-to-left scripts.

Messages are resolved at build: `formatMessage` returns final strings and the published HTML contains no message, no catalogue and no formatting library. Nothing in this package touches the DOM or is meant to run in a browser; a test checks that the sources reference no browser global.

### Overriding a label

The `labels` block of `theme.yaml` overrides any message, by language of a shipped catalogue then by identifier:

```yaml
labels:
  fr:
    site.home: Début
    entity.mentionsCount: "{count, plural, one {# citation} other {# citations}}"
```

An override uses the syntax of the message it replaces and must use exactly the variables of the source message. `validateLabels(theme.labels)` returns the configuration issues of the whole block, one per faulty key with the path `labels.<language>.<id>`: an unknown identifier, an ICU syntax error with the parser's message, or the missing and unknown variables. The theme validation of the command line is where to call it, so that a bad override is reported with the other theme errors before any rendering; `loadCatalogue(locale, { labels })` validates the block it applies as well and throws a `CatalogueError` carrying the same issues. Dependencies point from this package to `core`, never the other way, so `core` only describes the `labels` key in the theme schema.

### Adding a locale

1. Add `messages/<language>/<area>.json` for every area, with every key of `messages/en/<area>.json`, sorted, each value a translation that keeps the variables and kinds of the source message. Plural forms follow the CLDR categories of the language (`one`, `other`, ...).
2. Import each file in the module of its area under `src/areas/`, add the language to the `Area` type in `src/area.ts` and to `src/shipped.ts`, and to the `labels` key of `theme.schema.json` in the core package.
3. Run the tests: the parity test lists any missing key or differing variable.

### Dependencies

- `intl-messageformat` 11.2.15 (BSD-3-Clause, FormatJS): formats an ICU message with the plural rules, number and date formats of a locale through the platform `Intl` objects, without any locale data of its own.
- `@formatjs/icu-messageformat-parser` 3.5.18 (MIT, FormatJS): the parser `intl-messageformat` already uses, needed on its own to read the variables of a message for the parity test and the validation of overrides.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
