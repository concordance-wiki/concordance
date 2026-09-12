# Concordance lint action

Composite GitHub action that runs `concordance lint` on a knowledge repository and uploads the SARIF report to code scanning, so that each finding appears in the margin of the pull request diff. Published as `concordance-wiki/lint-action`; see the [distribution guide](../../docs/guides/lint-distribution.md#github-action) for the inputs and the outputs.

```yaml
name: lint
on: { pull_request: {} }
jobs:
  lint:
    runs-on: ubuntu-latest
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: concordance-wiki/lint-action@v0.1.0
        with:
          fail-on: warning
```

## Publishing

The `lint-action` repository holds `action.yml` and this file at its root, and nothing else. Each release of `@concordance-wiki/cli` is mirrored there: `action.yml` with its `version` default set to the released version, tagged `v<version>`, with the major tag (`v0`, then `v1`) moved to it. `scripts/check-distribution.mjs` in this repository keeps the default aligned with `packages/cli/package.json`; the `lint-distribution` workflow runs the action from this folder on the faulty corpus and compares its report with the other forms.
