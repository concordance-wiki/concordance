---
"@concordance-wiki/core": minor
---

Add the versioned plugin API: `definePlugin` validates a manifest against `plugin.schema.json` and brands it; `loadPlugins` loads the plugins declared in `concordance.yaml` in order into a deterministic registry with seven contribution points, disables a plugin whose system dependency is missing with a `W-PLUGIN-DISABLED` finding, and rejects an incompatible `apiVersion` or a duplicate contribution as a configuration error.
