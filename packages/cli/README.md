<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/cli</h1>

<p align="center"><strong>One command. The wiki and its linter, with exactly the plugins you pick.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/cli"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/cli?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md">Command line</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/cli/CHANGELOG.md">Changelog</a>
</p>

---

## Why

We now spend our days structuring knowledge for assistants: transcripts, specifications, glossaries, decisions, all in markdown, all in git. The AI reads it fine. We don't. It is scattered across repositories, nobody reads it twice, and nothing tells you that the term defined in the glossary is used in two hundred files, or that a decision taken in a meeting affects three screens.

Concordance takes those repositories exactly as they are and builds a wiki where every word your business uses has a page: the note someone wrote, if any, and every passage, in every file, that mentions it. No rewriting. No wikilinks. No frontmatter required. No server to run.

This package is the `concordance` command alone (`conc` for short): `build`, `render`, `export`, `init`, `validate-config`, `lint` and `gallery`, with the engine and none of the plugins. Install it to run the linter on a knowledge repository, or to build a wiki with exactly the plugins you choose. [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) is the same command with every official plugin already installed.

<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/docs/assets/screenshot-home.png" width="100%" alt="The home page of the wiki Concordance builds from its own repositories: a search field, the most cited words, the spaces fed by three repositories with their page counts and dates, the recently changed pages, and the footer saying where the site comes from">
</p>

## Quick start

```bash
npm install --save-dev @concordance-wiki/cli
```

`npx --yes @concordance-wiki/cli@0.1.0 lint` runs a pinned version without installing anything.

Check a knowledge repository on its merge requests, without any network access:

```bash
concordance lint --scope repo --fail-on warning --format sarif --output lint.sarif
```

Build a wiki from the repositories a configuration declares, then check the notes the way a merge request would:

```bash
concordance init --templates
concordance validate-config
concordance build --output dist
concordance lint --scope repo
```

Ask the built model what it knows, without the site, for a person at a terminal or for an agent:

```bash
concordance query "keyword page"
concordance query --search "threshold" --type rule
concordance query --text "we agreed to"
```

A plugin declared under `plugins:` in `concordance.yaml` is resolved by its package name from where the command is installed: `npm install --save-dev @concordance-wiki/plugin-reader-vtt` in the same project puts it where the command finds it.

## What you get

- **`build`**: validates the configuration, fetches the sources, runs the whole inference chain and writes `model.json`, `build.log.json`, the fragments and the site, a static folder that works over `file://`.
- **`lint`**: the local checks of one repository, or the global ones against the published model; text, JSON, SARIF or JUnit; the safe fixes announced before they are written.
- **`query`**: what the model knows about an expression, the note, where it is used, what it is linked to, the decisions that touched it; the search of the site, the lists, the counts, what nobody defined, what changed, where a phrase was spoken; text for a context or JSON under a published schema.
- **`render`** and **`export`**: the site again from an existing model without touching a source, and the model as a Cypher script.
- **`init`** and **`validate-config`**: a minimal, commented `concordance.yaml` with the note templates of every type, and every problem of a configuration with its path, received value and expectation.
- **`gallery`**: every slot of the site in every state, for the author of a theme.
- **Exit codes you can script on**: 0 done, 1 invalid input or failing findings, 2 execution error, whatever the command.
- **Reproducible output**: set `SOURCE_DATE_EPOCH` and two builds of unchanged sources are byte-identical.
- **A library too**: `main(argv, io)` runs a command over injected effects, `usage` lists them, `exitCodes` names the three codes.

## Documentation

- [Getting started](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md)
- [Command line](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md), every option and exit code
- [Distributing the linter](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/lint-distribution.md): `npx`, binary, GitHub action, GitLab component, container image, pre-commit hook
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md) and [pipelines](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/pipelines.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/cli/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

| Command | Effect | Exit codes |
|---|---|---|
| `validate-config [--config file]` | validates the configuration and reports every problem with its path, received value and expectation | 0 valid, 1 invalid, 2 file not found |
| `init [directory] [--templates]` | writes a minimal, commented `concordance.yaml`; with `--templates`, also copies the shipped [note templates](https://github.com/concordance-wiki/concordance/blob/main/docs/templates/README.md) under `templates/`, then the template of every type the plugins declared in the configuration contribute; never overwrites a file, and reports the ones it keeps | 0 written, 2 a file exists |
| `lint [--scope repo\|global] [--source name] [--config file] [--fail-on error\|warning\|info] [--format text\|json\|sarif\|junit] [--output file] [--fix] [--dry-run]` | checks the current directory as one knowledge repository: encoding, frontmatter, identifiers and internal links, with the rules of the named source and the overrides of `concordance-lint.yaml`, without any network access under `--scope repo`; `--scope global` also reads the published `model.json` named by `global.model` in `concordance-lint.yaml` (cached under `global.cache_dir` for `global.max_age_hours`) and checks cross-source links, frontmatter relations against the profile matrix and homonyms against its entities, or prints `global: <reason>; local checks only` on stderr and runs the local checks when the model is out of reach. Prints the sorted findings and their counts as text, or the JSON, SARIF 2.1.0 or JUnit report alone (JSON and SARIF carry the scope, and `degraded: true` with the reason); `--output` writes the report to that file. `--fix` first applies the safe corrections (deduced `type`, frontmatter key order, link to a renamed file), printing each as `fix: <path>:<line>: <description>` before writing and each refusal as `refused: ...`; `--dry-run` prints them as `would fix:` and writes nothing | 0 no finding at the `--fail-on` severity, 1 otherwise, 2 execution error, whatever the format |
| `gallery [--output dir] [--theme plugin] [--config file]` | renders every slot of the site with fixture view models, and every registered type from its note template, into a static page set under the output folder (`./gallery` by default): an index listing the slots, their states, the plugin behind every override and the types with the component that renders each, one page per slot and state and one per type, the stylesheet and the island bundles under `assets/`; the theme comes from `--theme` (a package name or a module path, repeatable), else from the `plugins:` of the configuration when one is found, else the default theme; every page is measured against the budget and checked for accessibility; see the [theming guide](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/theming.md#gallery) | 0 every page passes, 1 invalid configuration or a page over budget or with an accessibility finding, 2 execution error, a theme that cannot be loaded included |
| `build [--config file] [--output dir]` | validates the configuration, the lock file `lock` names and the profile, loads the plugins, fetches the sources, then runs the inference chain: parses the markdown, reads the other documents through the readers and converters of the plugins (metadata, PDF representation, the text of every page, cached by fingerprint under `conversion.cache`), types the notes and the documents, imports the contracts the source plugins read, builds the recognition dictionary of every locale, scans every note and every page of every document, produces the links (written links, frontmatter references, section and prose mentions, co-occurrence), combines their confidences, names the relation of every link from the profile, discovers and publishes the keyword pages (the `rejected_terms` of the lock file never proposed), reconciles twin resources (notes and documents alike, the `merged` and `separated` pairs of the lock file applied whatever the score), reports the documents left without a note as `W-DOC-NOMD` and runs the model checks; writes `build.log.json`, `model.json`, one `fragments/<id>.json` per entity (the note rendered to sanitised HTML with its written links and recognised words marked, the images it embeds kept under `fragments/<id>/` and the keyword addresses it took over, the documents of the entity with the text of their pages, their original file and PDF kept under `fragments/<id>/`, or the passages and the leads of a keyword page) and, per imported contract, `fragments/<api id>.contract.json` (the view the contract viewer of the API page fetches as soon as its script runs, copied from the contract cache) with the copy of a path contract kept under `fragments/<api id>/` for its download link, under the output folder (`--output`, else `build.output`, else `./dist` next to the configuration), then renders the site from those files as `render` does, which also writes one `fragments/<id>.mentions.json` per entity another note cites, holding every mention of the entity for the mentions panel of its page (the first `build.mentions_inline` are in the HTML); prints the summary: entities per type, links per method, keyword pages and discarded expressions, twin-resource statistics, the decisions of the lock file applied, findings per severity and per check, then the pages written, the former keyword addresses forwarding to a note, the size of each island bundle, the largest page against the 150 kB budget, the accessibility findings and the contrast pairs under the minimum; a page over budget or with an accessibility finding is a warning on stderr | 0 model and site written, 1 invalid configuration, lock file, profile or theme, or failing findings according to `build.fail_on` (errors, unconverted documents); 2 execution error (a plugin that cannot be loaded, a missing stopword file, a theme component that cannot be loaded) |
| `render [--model dist/model.json] [--output dir] [--config file]` | renders the site again from an existing `model.json` and the `fragments/` next to it, without touching a source: the configuration and the profile are read as the build reads them (site title, locale, plugins bringing a theme, `theme.yaml`, type labels), and the output folder (`--output`, else `build.output`, else `./dist`) receives `index.html`, one `<id>/index.html` per entity and per keyword page, `index/index.html`, `todo/index.html`, `search/index.html` with the search index next to it (`search/meta.js`, one `search/<prefix>.js` per shard, tokenised with the language packs and cut at `build.extracted_text_max_chars`) and `assets/`; an entity without a fragment renders without its note text, with a warning counting them; the contract views and copies the build kept are placed next to the API pages; see [the command line](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md#the-site) | 0 site written, 1 invalid configuration, profile, theme or model, 2 missing configuration or model file, or a theme that cannot be loaded |
| `export [--format cypher] [--model dist/model.json] [--output file]` | validates the model against the published schema and writes it as a Cypher script, on stdout unless `--output` names a file | 0 written, 1 model rejected by the schema, 2 missing model or unknown format |

### Executables

The package declares two executables, `concordance` and `conc`, both `dist/bin.js`; `dist`, `templates` and `package.json` are all it ships with its README and licence. `npx --yes @concordance-wiki/cli@<version> lint` runs the linter without installing anything else, and `npm install --save-dev @concordance-wiki/cli` makes `concordance` available to the scripts of a repository. The same command line is distributed as a standalone binary, a GitHub action, a GitLab CI/CD component, a container image and a pre-commit hook: see [Distributing the linter](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/lint-distribution.md).

Set `SOURCE_DATE_EPOCH` (seconds since the epoch) to pin the only timestamp of the outputs, the `at` field of `build.log.json` and of the `build` block of `model.json`; two builds of unchanged sources are then byte-identical. Any other value leaves the system clock.

The `templates/` folder of the package is a byte-for-byte copy of `docs/templates` of the repository, refreshed by `node scripts/sync-templates.mjs`; `pnpm lint` fails when the two differ.

</details>
