# Distribution

The forms of `concordance lint` that live in their own repository or project once published, kept here as their source of truth and validated by `scripts/check-distribution.mjs` and the `lint-distribution` workflow:

| Folder | Published as | Guide |
|---|---|---|
| [`github-action/`](github-action/README.md) | the `concordance-wiki/lint-action` repository on GitHub | [GitHub action](../docs/guides/lint-distribution.md#github-action) |
| [`gitlab-component/`](gitlab-component/README.md) | the `concordance-wiki/lint` project of the `concordance-wiki` group on GitLab | [GitLab CI/CD component](../docs/guides/lint-distribution.md#gitlab-cicd-component) |
| [`pre-commit/`](pre-commit/README.md) | [`.pre-commit-hooks.yaml`](../.pre-commit-hooks.yaml) at the root of this repository | [pre-commit hook](../docs/guides/lint-distribution.md#pre-commit-hook) |

The `npx` package is [`packages/cli`](../packages/cli/README.md), the standalone binary is built by `scripts/build-binary.mjs`, and the container image has its own workflow. Every form pins the version of `@concordance-wiki/cli`; `node scripts/check-distribution.mjs --write` aligns the pins after a release bump.
