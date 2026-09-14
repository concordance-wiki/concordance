# @concordance-wiki/profile

The meta-model of a Concordance wiki: the default profile with its types, relations, allowed pairs, confidence scale and type prefixes, the type modules, and the functions that load, validate and merge a project profile over it. Installed by `@concordance-wiki/cli`; you need it only to build on the engine, to read the relation matrix from a plugin for instance.

## Install

```bash
npm install @concordance-wiki/profile
```

## Use

```ts
import { allowedRelations, loadDefaultProfile, singleRelation } from "@concordance-wiki/profile";

const profile = loadDefaultProfile();
Object.keys(profile.types); // ["actor", "api", "application", ...], the types every wiki starts with
allowedRelations(profile, "api", "endpoint"); // ["exposes", "related"]
singleRelation(profile, "api", "endpoint"); // "exposes": the one relation besides the wildcards, else undefined
```

`resolveProfile(projectProfileText, { modules })` layers a project's `profile.yaml` and the type modules of its plugins over the default profile, the way the build does.

## What it contains

- `loadDefaultProfile`, `parseProfile`, `validateProfile`, `mergeProfiles`, `fingerprintProfile`, `resolveProfile`: the profile read, checked against its schema with every problem located, layered and hashed.
- `readTypeModule`, `readTypeModules`, `typeDefinitionOf`, `typesOf`, `typesDirectoryOf`: the type modules (`type.yaml`, `messages/<language>.json`, `template.md`, optionally `schema.json` and `components/`) a profile or a plugin adds.
- `allowedRelations`, `singleRelation`: the relation matrix for an ordered pair of types.
- `neighbourOrder`: the priority order of neighbour types a page of a type shows first.
- `default.yaml`, `base.yaml` and `types/<slug>/`: the reference meta-model shipped with the package.

## Documentation

- [Adding a type](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/adding-a-type.md)
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/profile/CHANGELOG.md)

## Inside

The package ships the default profile (`default.yaml`), the reference meta-model: types, relations with their allowed pairs, confidence scale and type prefixes per locale. The types are type modules under `types/<slug>/` (`type.yaml`, `messages/<language>.json`, `template.md`, optionally `schema.json` and `components/`), and `default.yaml` is assembled from them and from `base.yaml` by `scripts/assemble-profile.mjs` of the repository; a test checks that `readTypeModules` and `typesOf` assemble the same types as the published file.

`loadDefaultProfile` reads, validates and freezes the embedded profile; `parseProfile` and `validateProfile` check a document against the schema and report every problem with its path, the value received and the values expected; `mergeProfiles` layers a project profile on top of another, key by key (arrays replaced, `allowed` pairs added); `fingerprintProfile` hashes a profile canonically; `resolveProfile` chains all of that for a build. `readTypeModule` and `readTypeModules` read a module folder or a folder of them against the type-module schema and report every problem with its file; `typeDefinitionOf` and `typesOf` turn modules into the `types` block of a profile, labels taken from the messages; `resolveProfile` accepts `modules` to merge before the project profile, refusing a module of a type the default profile declares or two modules of one type, and drops the `types_dir` key of a project profile, which `typesDirectoryOf` reads for the caller. `allowedRelations` and `singleRelation` answer the relation matrix for a pair of types; `neighbourOrder` gives the priority order of neighbour types a page of a type shows first (`display.neighbours_order`), empty for a type without one, and the validation reports a `neighbours_order` naming a type the profile does not declare.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
