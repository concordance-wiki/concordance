# @concordance-wiki/cli

The `concordance` command (alias `conc`).

| Command | Effect | Exit codes |
|---|---|---|
| `validate-config [--config file]` | validates the configuration and reports every problem with its path, received value and expectation | 0 valid, 1 invalid, 2 file not found |
| `init [directory]` | writes a minimal, commented `concordance.yaml`; never overwrites | 0 written, 2 exists |
| `lint [--scope repo] [--source name] [--config file] [--fail-on error\|warning\|info] [--format text\|json\|sarif\|junit] [--output file]` | checks the current directory as one knowledge repository, without any network access: encoding, frontmatter, identifiers and internal links, with the rules of the named source and the overrides of `concordance-lint.yaml`; prints the sorted findings and their counts as text, or the JSON, SARIF 2.1.0 or JUnit report alone; `--output` writes the report to that file, the only file the command writes | 0 no finding at the `--fail-on` severity, 1 otherwise, 2 execution error, whatever the format (`--fix` and `--scope global` are refused in this version) |
| `build [--config file] [--output dir]` | validates the configuration, fetches the sources, parses the markdown, writes `build.log.json` under the output folder (`--output`, else `build.output`, else `./dist` next to the configuration) and prints the summary | 1 invalid configuration or failing findings according to `build.fail_on`; 2 execution error, including the steps not implemented yet |

Set `SOURCE_DATE_EPOCH` (seconds since the epoch) to pin the only timestamp of the outputs, the `at` field of `build.log.json`; two builds of unchanged sources are then byte-identical. Any other value leaves the system clock.

Part of [Concordance](../../README.md).
