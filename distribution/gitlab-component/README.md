# Concordance lint component

GitLab CI/CD component that adds a `concordance-lint` job to a pipeline: it runs `concordance lint` on the repository and publishes the JUnit report, listed by the merge request as failed tests, and the SARIF log, both as artifacts. Published from the `lint` project of the `concordance-wiki` group; see the [distribution guide](../../docs/guides/lint-distribution.md#gitlab-cicd-component) for the inputs.

```yaml
include:
  - component: $CI_SERVER_FQDN/concordance-wiki/lint/lint@0.1.0
    inputs:
      fail_on: warning
```

## Publishing

The `concordance-wiki/lint` project holds `templates/lint.yml` and this file; a release of the project publishes the component to the CI/CD catalog. Each release of `@concordance-wiki/cli` is mirrored there: `templates/lint.yml` with its `version` default set to the released version, released under that version. `scripts/check-distribution.mjs` in this repository keeps the default aligned with `packages/cli/package.json` and checks the inputs and the artifacts of the template.
