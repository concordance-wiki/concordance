# Query answer reference

Every key of `concordance query --format json`, generated from [`query.schema.json`](../../packages/core/schemas/query.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/command-line.md#query) explains how the keys work together.

Schema of the JSON answer of concordance query: the model it was read from, the entity the expression names, where the entity is used, what it is linked to, and the decisions and sessions among those links.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `model` (required) | object | — | — | The model the answer was read from. See [`model`](#model). |
| `entity` (required) | object | — | — | The entity the expression names, exactly as `model.json` serialises it under `entities` (see the model schema). |
| `occurrences` (required) | object | — | — | Where the entity is named, grouped by the note whose files hold the occurrences. See [`occurrences`](#occurrences). |
| `links` (required) | object | — | — | The entities linked to the queried one, best confidence first. See [`links`](#links). |
| `related` (required) | object[] | — | — | The decisions and the sessions linked to the entity, every one of them, best confidence first. See [`related[]`](#related). |

## `model`

The model the answer was read from.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `file` (required) | string | — | — | The model file as named on the command line. |
| `at` (required) | string | — | — | ISO 8601 date of the build that wrote the model. |
| `tool` (required) | string | — | — | Version of the command line that wrote the model. |
| `sources` (required) | string[] | — | — | The sources of the model, `name@commit` when the build recorded a commit. |
| `age` | string | — | — | The age of the model worded from the clock of the command; absent with --no-age. |

## `occurrences`

Where the entity is named, grouped by the note whose files hold the occurrences.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `notes` (required) | object[] | — | — | The notes listed under the bound, by source then identifier. See [`occurrences.notes[]`](#occurrencesnotes). |
| `more_notes` (required) | integer | — | at least 0 | Notes the bound left out. |
| `total` (required) | integer | — | at least 0 | Every occurrence, listed or not. |

### `occurrences.notes[]`

The notes listed under the bound, by source then identifier.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `source` (required) | string | — | — | Name of the source holding the files. |
| `note` | object | — | — | The note whose files hold the occurrences; absent when no note of the model owns the file. See [`occurrences.notes[].note`](#occurrencesnotesnote). |
| `occurrences` (required) | object[] | — | — | The occurrences listed under the bound, by path then line. See [`occurrences.notes[].occurrences[]`](#occurrencesnotesoccurrences). |
| `more` (required) | integer | — | at least 0 | Occurrences of the note the bound left out. |

### `occurrences.notes[].note`

The note whose files hold the occurrences; absent when no note of the model owns the file.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `id` (required) | string | — | — | Identifier of the note. |
| `title` (required) | string | — | — | Title of the note. |
| `type` (required) | string | — | — | Type of the note. |

### `occurrences.notes[].occurrences[]`

The occurrences listed under the bound, by path then line.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `path` (required) | string | — | — | Forward-slash path of the file relative to its source. |
| `line` (required) | integer | — | at least 1 | Line of the occurrence, 1-based. |
| `context` (required) | string | — | — | The text around the occurrence. |
| `method` | string | — | — | The method of the link that recorded the occurrence; absent for a passage of a keyword page. |

## `links`

The entities linked to the queried one, best confidence first.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `entries` (required) | object[] | — | — | The links listed under the bound. See [`links.entries[]`](#linksentries). |
| `more` (required) | integer | — | at least 0 | Links the bound left out. |

### `links.entries[]`

One entity linked to the queried one.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `id` (required) | string | — | — | Identifier of the linked entity. |
| `title` (required) | string | — | — | Title of the linked entity. |
| `type` (required) | string | — | — | Type of the linked entity. |
| `domain` | string | — | — | Domain of the linked entity, when it has one. |
| `relation` (required) | string | — | — | Relation of the link, a slug of the profile. |
| `direction` (required) | enum | — | `out`, `in` | `out` when the queried entity is the source of the link, `in` when it is the target. |
| `confidence` (required) | number | — | 0 to 1 | Combined confidence of the link, in [0, 1]. |
| `methods` (required) | string[] | — | — | The methods that claim the link, in code-unit order. |
