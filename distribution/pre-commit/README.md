# Concordance lint pre-commit hook

The hook `concordance-lint` runs `concordance lint --scope repo` before each commit that touches a markdown or YAML file. pre-commit reads a hook manifest at the root of the repository named by `repo:`, so the manifest lives at [`.pre-commit-hooks.yaml`](../../.pre-commit-hooks.yaml) at the root of this repository, not in this folder; see the [distribution guide](../../docs/guides/lint-distribution.md#pre-commit-hook) for the configuration to copy.

```yaml
repos:
  - repo: https://github.com/concordance-wiki/concordance
    rev: "@concordance-wiki/cli@0.1.0"
    hooks:
      - id: concordance-lint
```

The manifest pins `@concordance-wiki/cli` at the version of `packages/cli`, through `additional_dependencies`; `scripts/check-distribution.mjs` verifies the pin, and the `lint-distribution` workflow validates the manifest with `pre-commit validate-manifest`.
