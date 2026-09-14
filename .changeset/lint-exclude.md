---
"@concordance-wiki/core": minor
"@concordance-wiki/lint": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/ingest": minor
---

`concordance-lint.yaml` gains an `exclude` key, globs of the files of the repository that are never read, counted or reported, with the syntax of `privacy.exclude`; the file is validated against a published `lint.schema.json`, documented by a generated reference page. The files git ignores are left out the same way, every `.gitignore` of the repository being read with the rules git applies, and `concordance lint --no-gitignore` checks them anyway. The build lists the files of a source exactly as the linter does, honouring the `exclude` of the repository and its ignore files, and skips with a `W-SOURCE-UNREACHABLE` finding a source whose lint configuration is faulty; the parity test holds it on an excluded folder and an ignored file of the faulty corpora.
