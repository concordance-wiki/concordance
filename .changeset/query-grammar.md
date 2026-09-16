---
"@concordance-wiki/cli": minor
"@concordance-wiki/core": patch
---

`concordance query` reads one section alone (`--occurrences`, `--links`, `--related`), walks the way to another entity (`--path <target>`, `--max-depth`), lists the entities of the model (`--list` with `--type`, `--domain`, `--application`, `--source`, `--status`, `--all`), and finds its model through `concordance.yaml` of the working directory or `--config`, then through the published model of `concordance-lint.yaml`, when `--model` names none; options that do not go together are refused by name.
