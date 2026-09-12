# @concordance-wiki/lint

The distributable linter: the local check of one knowledge repository, its `concordance-lint.yaml` overrides and the text report.

| Export | Effect |
|---|---|
| `lintRepository({ root, source?, config?, fs })` | lists the files under `root`, reads each markdown file once and reports `E-ENCODING`, `E-FM-INVALID`, `E-ID-INVALID`, `E-ID-DUP` (with the type suffixes of the source's rules stripped) and `E-LINK-BROKEN` for internal links; a `source:` prefixed target or one leaving the root is left to the global mode. `privacy.exclude` and `checks` of the configuration apply, then the overrides of `<root>/concordance-lint.yaml`; the findings come back enriched by the check registry and sorted |
| `readLintOverrides(fs, root)`, `parseLintConfig(text)` | the `checks` block of `concordance-lint.yaml`, validated against the same schema as the configuration; a faulty file throws `LintConfigError` |
| `formatFindings(findings)` | one line per finding, `<severity>: <path>:<line>: <check>: <message> (<documentation url>)`, then the counts |
| `hasFindingAtOrAbove(findings, severity)` | the `--fail-on` verdict |

Nothing here opens a network connection or writes a file. The type cascade and the checks that depend on it join the local lint with the typing package.

Part of [Concordance](../../README.md).
