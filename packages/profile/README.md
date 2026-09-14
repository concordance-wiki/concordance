<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/profile</h1>

<p align="center"><strong>The meta-model: the types a wiki starts with, the relations between them, and how a project extends both.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/profile"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/profile?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/adding-a-type.md">Adding a type</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/profile/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance gives typed pages to your notes, terms, rules, screens, decisions, APIs, and names the relation between two of them: an API exposes an endpoint, a decision affects a screen. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package is the part of it that holds the meta-model: the default profile with its types, relations, allowed pairs and confidence scale, the type modules with their template and messages, and the functions that layer a project's `profile.yaml` and the types of its plugins over the default. Install it alone to build on the engine, or to read the relation matrix from a plugin.

## Quick start

```bash
npm install @concordance-wiki/profile
```

```ts
import { allowedRelations, loadDefaultProfile, singleRelation } from "@concordance-wiki/profile";

const profile = loadDefaultProfile();
Object.keys(profile.types); // ["actor", "api", "application", ...], the types every wiki starts with
allowedRelations(profile, "api", "endpoint"); // ["exposes", "related"]
singleRelation(profile, "api", "endpoint"); // "exposes": the one relation besides the wildcards, else undefined
```

`resolveProfile(projectProfileText, { modules })` layers a project's `profile.yaml` and the type modules of its plugins over the default profile, the way the build does.

## What you get

- **A meta-model out of the box**: `default.yaml`, `base.yaml` and one `types/<slug>/` module per type, shipped with the package.
- **A profile read and checked**: `loadDefaultProfile`, `parseProfile`, `validateProfile` against the schema, every problem located.
- **Extension without a fork**: `mergeProfiles` and `resolveProfile` layer a project profile and the type modules of plugins over the default; `fingerprintProfile` says when it changed.
- **Type modules**: `readTypeModule`, `readTypeModules`, `typeDefinitionOf`, `typesOf`, the `type.yaml`, `messages/<language>.json`, `template.md`, optional `schema.json` and `components/` a profile or a plugin adds.
- **The relation matrix**: `allowedRelations` and `singleRelation` for an ordered pair of types, what the inference and the linter read.
- **What a page shows first**: `neighbourOrder`, the priority of neighbour types for a page of a given type.

## Documentation

- [Adding a type](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/adding-a-type.md)
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/profile/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

The package ships the default profile (`default.yaml`), the reference meta-model: types, relations with their allowed pairs, confidence scale and type prefixes per locale. The types are type modules under `types/<slug>/` (`type.yaml`, `messages/<language>.json`, `template.md`, optionally `schema.json` and `components/`), and `default.yaml` is assembled from them and from `base.yaml` by `scripts/assemble-profile.mjs` of the repository; a test checks that `readTypeModules` and `typesOf` assemble the same types as the published file.

`loadDefaultProfile` reads, validates and freezes the embedded profile; `parseProfile` and `validateProfile` check a document against the schema and report every problem with its path, the value received and the values expected; `mergeProfiles` layers a project profile on top of another, key by key (arrays replaced, `allowed` pairs added); `fingerprintProfile` hashes a profile canonically; `resolveProfile` chains all of that for a build. `readTypeModule` and `readTypeModules` read a module folder or a folder of them against the type-module schema and report every problem with its file; `typeDefinitionOf` and `typesOf` turn modules into the `types` block of a profile, labels taken from the messages; `resolveProfile` accepts `modules` to merge before the project profile, refusing a module of a type the default profile declares or two modules of one type, and drops the `types_dir` key of a project profile, which `typesDirectoryOf` reads for the caller. `allowedRelations` and `singleRelation` answer the relation matrix for a pair of types; `neighbourOrder` gives the priority order of neighbour types a page of a type shows first (`display.neighbours_order`), empty for a type without one, and the validation reports a `neighbours_order` naming a type the profile does not declare.

</details>
