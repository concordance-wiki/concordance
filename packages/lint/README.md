<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/lint</h1>

<p align="center"><strong>The checks of the build, on one repository, before you push.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/lint"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/lint?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/lint-distribution.md">Distributing the linter</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/lint/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance checks your knowledge repositories the way a compiler checks code: broken links, duplicate identifiers, invalid frontmatter, wrong encoding, annotated in the merge request before a note reaches the wiki. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) or [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli) for that, and run `concordance lint`. This package is the linter as a library: the local check of one repository without any network access, the global check against the published model, the safe fixes, and the reports a forge reads. Install it alone to embed the same checks in another tool.

## Quick start

```bash
npm install @concordance-wiki/lint
```

The same findings `concordance lint --scope repo` prints, on a folder of notes:

```ts
import { nodeFileSystem } from "@concordance-wiki/core";
import { formatFindings, hasFindingAtOrAbove, lintRepository } from "@concordance-wiki/lint";

const findings = lintRepository({ root: "/srv/wiki/specs", fs: nodeFileSystem });
for (const line of formatFindings(findings)) console.log(line);
// error: checks/link-broken.md:3: E-LINK-BROKEN: link "finding.md" in checks/link-broken.md points to no file of source repo (https://github.com/concordance-wiki/concordance/blob/main/docs/checks/E-LINK-BROKEN.md)
// 1 finding: 1 error, 0 warnings, 0 info
process.exitCode = hasFindingAtOrAbove(findings, "warning") ? 1 : 0;
```

## What you get

- **The local scope**: `lintRepository` reads one repository, encoding, frontmatter, identifiers and internal links, with no network, and reports exactly what the build would for the same files.
- **The global scope**: `lintGlobal` also reads the published `model.json`, cached, and checks the links to the other repositories, the frontmatter relations and the homonyms; when the model is out of reach it says so and runs the local checks.
- **Safe fixes, announced first**: `fixRepository` adds the deduced `type`, orders the frontmatter keys and repairs a link to a renamed file, never adds or removes a link, and runs dry when asked.
- **Reports a forge reads**: text, JSON, SARIF 2.1.0 for GitHub and JUnit for GitLab, each finding with its documentation URL: `formatFindingsAs`.
- **A verdict for CI**: `hasFindingAtOrAbove`, the `--fail-on` threshold.
- **Overrides per repository**: `readLintConfig` and `readLintOverrides` read the `exclude`, `checks` and `global` blocks of `concordance-lint.yaml`.

## Documentation

- [Command line](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md), the `lint` command
- [Distributing the linter](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/lint-distribution.md): `npx`, binary, GitHub action, GitLab component, container image, pre-commit hook
- [Pipelines](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/pipelines.md)
- [The checks](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/README.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/lint/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

| Export | Effect |
|---|---|
| `lintedFiles({ root, fs, config?, overrides?, gitignore? })` | the files every scope reads, through `repositoryFiles` of the core: everything under `root` but `privacy.exclude` of the configuration, `exclude` of `concordance-lint.yaml` and, unless `gitignore` is false, what the `.gitignore` files of the repository ignore; the build lists the files of a source the same way |
| `lintRepository({ root, source?, config?, fs, gitignore? })` | lists the files under `root` with `lintedFiles`, reads each markdown file once and reports `E-ENCODING`, `E-FM-INVALID`, `E-ID-INVALID`, `E-ID-DUP` (with the type suffixes of the source's rules stripped) and `E-LINK-BROKEN` for internal links; a `source:` prefixed target or one leaving the root is left to the global mode. `privacy.exclude` and `checks` of the configuration apply, then the overrides of `<root>/concordance-lint.yaml`; the findings come back enriched by the check registry and sorted, and are the ones the build produces for the same checks on the same repository |
| `LOCAL_CHECKS` | the sorted identifiers of the checks above, the family on which the linter and the build agree; a parity test in the command-line package holds them to it on every fixture corpus |
| `fixRepository({ root, source?, config?, fs, dryRun, announce?, gitignore? })` | runs the safe fixers over every markdown file `lintedFiles` lists: `rewriteRenamedLinks` on the text as written, then `normalizeFrontmatter` with the type `deduceType` gives; calls `announce` with every change before the first write, writes only the files whose text changed and only when `dryRun` is false; returns the changes (files in path order, changes in file order), the refusals and the number of files changed |
| `normalizeFrontmatter(text, { path, deducedType? })` | adds `type: <deducedType>` to a valid frontmatter block that has none, orders its keys (`CANONICAL_KEY_ORDER`, then alphabetically), keeps comments and value styles, and returns the body byte for byte; a file without frontmatter, an invalid YAML block, a non-mapping or a duplicate key leaves the text untouched |
| `rewriteRenamedLinks(text, { path, sourceFiles })` | for every link to a missing file, when exactly one file carries the same name and extension, replaces the destination characters with the path relative to the note, anchor kept; several such files are a refusal naming them, none leaves the finding; a destination written between angle brackets is refused too |
| `deduceType({ path, frontmatter, source })` | the type the source gives a file, by increasing precedence `default_type`, `type`, then the `rules` in order (`path` glob, `suffix`, `ext`, `frontmatter` key; every written criterion must hold; the last match wins); nothing without a declared source. A small local cascade over `SourceConfig.rules`, kept next to the fixers that need it |
| `lintGlobal({ root, source?, config?, overrides, fs, clock, fetch?, profile, gitignore? })` | the global scope: resolves the `global` block of `concordance-lint.yaml` (`resolveGlobalConfig`), loads the published model (`loadPublishedModel`: a path is read as it is; a URL is served from `<cache_dir>/model.json` while `model.meta.json` says it is younger than `max_age_hours`, else fetched again with `If-None-Match` and `If-Modified-Since`, a `304` renewing the copy, a failed refresh keeping the stale copy with its age), then runs `globalFindings` over the local notes and the remote entities: `E-LINK-BROKEN` for a `<source>:` or `../<source>/` link to a note the model does not know, `W-LINK-CROSS-SOURCE` for one it knows when `build.cross_source_links` is false, `E-META-REL` for a frontmatter reference whose type pair the profile forbids for the key's relation, `I-TERM-HOMONYM` for a title or alias a remote entity of another type carries (`GLOBAL_CHECKS` lists them). Returns the enriched findings and the model's origin, or `degraded: { reason }` with no finding when no model could be read; never throws for that, never rebuilds, writes the cache only |
| `mergeFindings(local, global)` | the local findings plus the global ones that do not repeat one (same check, path, line and entity), sorted canonically |
| `readLintConfig(fs, root)`, `readLintOverrides(fs, root)`, `parseLintConfig(text)` | re-exported from the core: the `exclude`, `checks` and `global` blocks of `concordance-lint.yaml` (`model`, `cache_dir`, `max_age_hours`, `profile`), validated against `lint.schema.json`, whose `checks` is the block of the configuration schema; a faulty file throws `LintConfigError` |
| `formatFindings(findings)` | one line per finding, `<severity>: <path>:<line>: <check>: <message> (<documentation url>)`, then the counts |
| `formatFindingsAs(format, findings, { root, version, registry, scope? })` | the whole report as one document ending with a newline: `text` (the lines above), `json` (`{ version: 1, tool, scope, checks, findings, summary }` with the documentation URL on each finding), `sarif` (a SARIF 2.1.0 log with one rule per check met, taken from the registry, and one result per finding located by file relative to `%SRCROOT%` and line) or `junit` (one test suite, one test case per finding, errors and warnings as failures, info as output, one passing `no finding` case when the list is empty); `formatJson`, `formatSarif` and `formatJunit` are exported on their own, the findings are sorted canonically in every format; `scope` names the scope in the JSON report and in the SARIF run `properties`, with `degraded: true` and the `reason` when the global scope fell back to the local checks; `checks` lists what ran, `LOCAL_CHECKS` in the `repo` scope and `LOCAL_CHECKS` with `GLOBAL_CHECKS`, once each and sorted, in the `global` scope, back to `LOCAL_CHECKS` alone when it is degraded |
| `hasFindingAtOrAbove(findings, severity)` | the `--fail-on` verdict |

Only `lintGlobal` opens a network connection, through the `fetch` it is given, and only to read the published model; `fixRepository` writes what it announced and `lintGlobal` writes its cache, nothing else writes. The fixers never add or remove a link and never write an inferred relation: a fixed file differs from the original in its frontmatter block and in existing link destinations only, and a second pass changes nothing. The checks that depend on the type cascade join the local lint with the typing package.

</details>
