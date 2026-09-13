---
"@concordance-wiki/core": minor
"@concordance-wiki/profile": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/lint": minor
---

Types as modules: a type is a folder `types/<slug>/` holding `type.yaml`, `messages/<language>.json`, `template.md` and optionally `schema.json` and `components/`, published by `type-module.schema.json`; the core types are such modules under `packages/profile/types/`, the default profile is assembled from them, and `resolveProfile` merges the modules a caller reads (`readTypeModules`) before the project profile, which may name a folder of modules under `types_dir`. A plugin contributes modules through the new `types` contribution point (registered in declared order, two plugins bringing one slug being a configuration error); the build and the render merge the modules of the plugins and of `types_dir` before the project profile, the global lint reads `types_dir`, and `concordance init --templates` also copies the templates of the types the declared plugins contribute.
