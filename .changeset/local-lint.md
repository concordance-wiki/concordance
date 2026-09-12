---
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
---

Local lint without network: `concordance lint --scope repo` checks the current repository file by file (UTF-8 encoding, YAML frontmatter, identifiers unique once the source's type suffixes are stripped, internal links) with the rules of the source named by `--source` and the `checks` overrides of `--config` and of a `concordance-lint.yaml` at the root, prints the findings sorted with their documentation URL and their counts, and exits according to `--fail-on`; `--fix` and `--scope global` are refused until their stories land.
