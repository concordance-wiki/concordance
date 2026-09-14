# W-SOURCE-UNREACHABLE

**Severity:** warning. **Family:** sources.

A declared source could not be fetched or read, so the build went on without it.

The repository URL is wrong, the ref does not exist, the pipeline has no credentials for it, the local path is missing, or the `concordance-lint.yaml` of the repository is faulty, in which case the build cannot list its files the way its linter does and skips it rather than read what the linter refuses to check. Nothing from that source enters the model: its entities are absent, and links towards them from other sources resolve to nothing until the source comes back.

## Before

```
sources:
  - name: specs
    git: https://forge.example/knowledge/spec.git   (repository not found)
```

## After

```
sources:
  - name: specs
    git: https://forge.example/knowledge/specs.git
```

## How to fix

Fix the URL, the ref or the path, or the `concordance-lint.yaml` of the repository as `concordance lint` reports it. For a private repository, give the pipeline read access through git (token in a URL rewrite, credential helper or deploy key, see the [configuration guide](../guides/configuration.md#private-repositories)); the build never prompts for credentials and says so in the finding when git asked for them. Raise the severity to `error` under `checks:` when a missing source must fail the build.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
