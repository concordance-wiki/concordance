<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/typing</h1>

<p align="center"><strong>Decides what every file is, a term, a rule, a screen, a decision, from its folder, its name or its frontmatter.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/typing"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/typing?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/adding-a-type.md">Adding a type</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/typing/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance builds a wiki from your repositories with zero configuration, and gets richer when you tell it that everything under `screens/` is a screen and every `.rule.md` is a rule. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package is the part of it that applies those rules: the type cascade that gives every markdown file its type, the entity built from a parsed note, and the application and domain each entity is filed under. The build and the linter both call it, so a type is decided the same way on your machine and in the published wiki. Install it alone to build on the engine.

## Quick start

```bash
npm install @concordance-wiki/typing
```

The type of one file, from the rules of its source and its frontmatter, the way `concordance build` and `concordance lint` decide it:

```ts
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { resolveType } from "@concordance-wiki/typing";

const source = { name: "specs", rules: [{ match: { suffix: ".rule.md" }, set: { type: "rule" } }] };
const resolved = resolveType({ source, path: "checks/link-broken.rule.md", frontmatter: {}, profile: loadDefaultProfile() });
resolved.type; // "rule"
resolved.origin; // "suffix": the kind of rule that matched, "frontmatter" when the note says its type
```

## What you get

- **One cascade, four levels**: `resolveType` applies the source's `default_type`, its `type`, the typing rules in order and the frontmatter `type`, in increasing precedence, and says which one decided.
- **Conflicts named**: `E-TYPE-CONFLICT` when a note contradicts its suffix rule, `W-TYPE-UNKNOWN` when the profile does not know the type.
- **A note becomes an entity**: `buildEntity` and `buildResourceEntity` give each file its identifier, title, aliases, status, summary, attributes and location.
- **Filed where it belongs**: `compileDomains`, `resolveDomain`, `resolveApplication` and the `W-APP-*` and `W-DOMAIN-*` findings when a note is filed nowhere or somewhere undeclared.
- **The whole corpus at once**: `typeSources` runs all of the above over every parsed file, resolves duplicate identifiers (`E-ID-DUP`) and returns entities and findings in canonical order.

## Documentation

- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md), the `sources` and `rules` blocks
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Adding a type](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/adding-a-type.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/typing/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

`resolveType` runs the type cascade of one markdown file, in increasing precedence the source's `default_type`, the source's `type`, the typing rules in order (`path` glob, `suffix`, `ext`, `frontmatter` criteria, every criterion of a rule required, the last match wins) and the frontmatter `type`; it records the origin (`source`, `rule#3`, `suffix`, `frontmatter`), the attribute defaults set by the matching rules, `E-TYPE-CONFLICT` when the frontmatter contradicts a suffix rule (the frontmatter is kept) and `W-TYPE-UNKNOWN` when the profile does not declare the type (the note becomes a `document`). `buildEntity` turns one ingested and parsed file into an `Entity`: deterministic identifier, title (frontmatter, H1, file name), aliases, status, summary (frontmatter, first paragraph), the frontmatter attributes over the rule defaults with `W-ATTRIBUTE-UNKNOWN` for the keys the type and the common attributes do not declare, the source location, the type origin and `graph` (`documents-only` for the types the profile marks so, `document` and `meeting` by default); `buildResourceEntity` does the same for a file a reader or a converter knows. `compileDomains` flattens the `domains` tree of the configuration into id paths (`inference/recognition`) with one glob matcher each, and `resolveDomain` files one path under the frontmatter `domain` (by id or id path; an unknown value is kept as written and marked undeclared), else under the deepest domain whose globs match the source-relative path (the last declared wins at equal depth), else under `unclassified`. `resolveApplication` takes the frontmatter `application`, else a rule's `set.application`, else the source's `application`, and says whether `applications:` declares it. `buildEntity` records both on the entity and `filingFindings` reports `W-APP-MISSING`, `W-APP-UNKNOWN`, `W-DOMAIN-UNCLASSIFIED` and `W-DOMAIN-UNKNOWN`, the first and the third never for the container types (applications and domains as notes). `typeSources` does it for every parsed markdown file and every known resource of the ingested sources, resolves duplicate identifiers (`E-ID-DUP`) and returns entities and findings in canonical order.

</details>
