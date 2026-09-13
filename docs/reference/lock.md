# Lock file reference

Every key of `concordance.lock.yaml`, generated from [`lock.schema.json`](../../packages/core/schemas/lock.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/configuration.md#lock) explains how the keys work together.

Schema of concordance.lock.yaml, the record of the human decisions the build applies over its inferences: promoted and rejected links, twin resources merged or kept apart, expressions the keyword discovery must not propose.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `version` (required) | constant | — | `1` | Version of this schema; always 1. |
| `links` | object | — | — | Human decisions about inferred links: the promoted and the rejected ones. Recorded for the later versions; not read by this one. See [`links`](#links). |
| `duplicates` | object | — | — | Human decisions about twin resources, applied whatever the score of the pair. See [`duplicates`](#duplicates). |
| `rejected_terms` | string[] | — | each: non-empty | Expressions the keyword discovery never proposes again: no candidate, no W-TERM-UNDEFINED, no keyword page. Compared on the normalised form. |

## `links`

Human decisions about inferred links: the promoted and the rejected ones. Recorded for the later versions; not read by this one.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `accepted` | object[] | — | — | Inferred links promoted by a human; each becomes a lock_promoted link at the confidence the profile gives that method. See [`links.accepted[]`](#linksaccepted). |
| `rejected` | object[] | — | — | Inferred links a human rejected; the build never produces them again. See [`links.rejected[]`](#linksrejected). |

### `links.accepted[]`

Inferred links promoted by a human; each becomes a lock_promoted link at the confidence the profile gives that method.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `from` (required) | string | — | — | Identifier of the source entity. |
| `to` (required) | string | — | — | Identifier of the target entity. |
| `rel` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Relation slug of the profile. |
| `by` | string | — | — | Who took the decision: a role or a pseudonym, never a real name. |
| `at` | string | — | format `date` | Date of the decision, ISO 8601 (YYYY-MM-DD). |

### `links.rejected[]`

Inferred links a human rejected; the build never produces them again.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `from` (required) | string | — | — | Identifier of the source entity. |
| `to` (required) | string | — | — | Identifier of the target entity. |
| `rel` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Relation slug of the profile. |
| `reason` | string | — | — | Why the link was rejected. |

## `duplicates`

Human decisions about twin resources, applied whatever the score of the pair.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `merged` | string[][] | — | each: exactly 2 items | Pairs of resource identifiers that merge into one entity whatever their score. |
| `separated` | string[][] | — | each: exactly 2 items | Pairs of resource identifiers that never merge and produce no W-DUP-CANDIDATE finding. |
