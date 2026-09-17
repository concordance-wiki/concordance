---
"@concordance-wiki/lint": patch
"@concordance-wiki/cli": patch
---

`lint --scope global` reads the profile the wiki configuration names when `--config` gives one, with its `types_dir`, as the build does, so that `E-META-REL` judges the same pairs against the same matrix; `global.profile` of `concordance-lint.yaml` still replaces it.
