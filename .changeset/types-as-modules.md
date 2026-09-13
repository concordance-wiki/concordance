---
"@concordance-wiki/core": minor
"@concordance-wiki/profile": minor
---

Types as modules: a type is a folder `types/<slug>/` holding `type.yaml`, `messages/<language>.json`, `template.md` and optionally `schema.json` and `components/`, published by `type-module.schema.json`; the core types are such modules under `packages/profile/types/`, the default profile is assembled from them, and `resolveProfile` merges the modules a caller reads (`readTypeModules`) before the project profile, which may name a folder of modules under `types_dir`.
