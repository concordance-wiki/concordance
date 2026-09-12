# @concordance-wiki/cli

The `concordance` command (alias `conc`).

| Command | Effect | Exit codes |
|---|---|---|
| `validate-config [--config file]` | validates the configuration and reports every problem with its path, received value and expectation | 0 valid, 1 invalid, 2 file not found |
| `init [directory]` | writes a minimal, commented `concordance.yaml`; never overwrites | 0 written, 2 exists |
| `lint [--scope repo] [--source name] [--config file] [--fail-on error\|warning\|info] [--format text\|json\|sarif\|junit] [--output file] [--fix] [--dry-run]` | checks the current directory as one knowledge repository, without any network access: encoding, frontmatter, identifiers and internal links, with the rules of the named source and the overrides of `concordance-lint.yaml`; prints the sorted findings and their counts as text, or the JSON, SARIF 2.1.0 or JUnit report alone; `--output` writes the report to that file. `--fix` first applies the safe corrections (deduced `type`, frontmatter key order, link to a renamed file), printing each as `fix: <path>:<line>: <description>` before writing and each refusal as `refused: ...`; `--dry-run` prints them as `would fix:` and writes nothing | 0 no finding at the `--fail-on` severity, 1 otherwise, 2 execution error, whatever the format (`--scope global` is refused in this version) |
| `gallery [--output dir] [--theme plugin] [--config file]` | renders every slot of the site with fixture view models into a static page set under the output folder (`./gallery` by default): an index listing the slots, their states and the plugin behind every override, one page per slot and state, the stylesheet and the island bundles under `assets/`; the theme comes from `--theme` (a package name or a module path, repeatable), else from the `plugins:` of the configuration when one is found, else the default theme; every page is measured against the budget and checked for accessibility; see the [theming guide](../../docs/guides/theming.md#gallery) | 0 every page passes, 1 invalid configuration or a page over budget or with an accessibility finding, 2 execution error, a theme that cannot be loaded included |
| `build [--config file] [--output dir]` | validates the configuration and the profile, fetches the sources, parses the markdown, types the notes, resolves the written links, writes `build.log.json` and `model.json` under the output folder (`--output`, else `build.output`, else `./dist` next to the configuration) and prints the summary: entities per type, links per method, findings per severity and per check | 1 invalid configuration or profile, or failing findings according to `build.fail_on`; 2 execution error, including the steps not implemented yet |
| `export [--format cypher] [--model dist/model.json] [--output file]` | validates the model against the published schema and writes it as a Cypher script, on stdout unless `--output` names a file | 0 written, 1 model rejected by the schema, 2 missing model or unknown format |

## Executables

The package declares two executables, `concordance` and `conc`, both `dist/bin.js`; `dist` and `package.json` are all it ships. `npx --yes @concordance-wiki/cli@<version> lint` runs the linter without installing anything else, and `npm install --save-dev @concordance-wiki/cli` makes `concordance` available to the scripts of a repository. The same command line is distributed as a standalone binary, a GitHub action, a GitLab CI/CD component, a container image and a pre-commit hook: see [Distributing the linter](../../docs/guides/lint-distribution.md).

Set `SOURCE_DATE_EPOCH` (seconds since the epoch) to pin the only timestamp of the outputs, the `at` field of `build.log.json` and of the `build` block of `model.json`; two builds of unchanged sources are then byte-identical. Any other value leaves the system clock.

Part of [Concordance](../../README.md).
