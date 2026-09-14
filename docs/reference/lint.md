# Lint configuration reference

Every key of `concordance-lint.yaml`, generated from [`lint.schema.json`](../../packages/core/schemas/lint.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/configuration.md#concordance-lintyaml) explains how the keys work together.

Schema of concordance-lint.yaml, read at the root of a knowledge repository by concordance lint and by the build that declares the repository as a source: the files the repository keeps out of the checks, the local overrides of the check registry and where the global scope finds the published model.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `exclude` | string[] | — | each: non-empty | Globs of the files never read, never counted and never reported, relative to the root of the repository, with the same syntax as privacy.exclude in concordance.yaml; the build applies them too when it reads the repository as a source. |
| `checks` | map of object | — | keys: pattern `^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$` | Overrides of the check registry, by check identifier: disable a check or change the severity of its findings. An identifier no loaded check registers is an execution error. See [`checks.*`](#checks). |
| `global` | object | — | — | Where the global scope finds the published model of the wiki and how long its copy lives; without a model, --scope global degrades to the local checks. See [`global`](#global). |

## `checks.*`

Overrides of the check registry, by check identifier: disable a check or change the severity of its findings. An identifier no loaded check registers is an execution error.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `severity` | enum | — | `error`, `warning`, `info` | Severity given to every finding of the check, replacing its default. |
| `enabled` | boolean | `true` | — | Whether the check runs; false drops its findings from the build log and the model. |

## `global`

Where the global scope finds the published model of the wiki and how long its copy lives; without a model, --scope global degrades to the local checks.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `model` | string | — | non-empty | The published model.json: a URL (https://…/model.json) fetched and cached, or a path relative to the repository read as it is. |
| `cache_dir` | string | `".concordance-cache/lint"` | non-empty | Folder of the cached model and of its metadata, relative to the repository. |
| `max_age_hours` | number | `24` | at least 0 | Hours during which the cached model is reused without any request; 0 revalidates on every run. |
| `profile` | string | — | non-empty | A project profile, relative to the repository, merged over the default one for the relation matrix and the types of the global checks. |
