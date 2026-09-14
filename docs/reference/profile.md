# Profile reference

Every key of `profile.yaml`, generated from [`profile.schema.json`](../../packages/core/schemas/profile.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/writing-notes.md#profile) explains how the keys work together.

Schema of the meta-model profile (packages/profile/default.yaml and project overrides).

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `profile` | string | — | — | Name of the profile. |
| `types_dir` | string | — | — | Folder of type modules a project profile adds, relative to the profile file: one folder per type, read before the keys of the profile itself. Meaningless in the default profile. |
| `version` (required) | constant | — | `1` | Version of this schema; always 1. |
| `groups` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | Groups of types, by slug; every type belongs to one. See [`groups.*`](#groups). |
| `common_attributes` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | Attributes every entity carries whatever its type, by name; a type may refine one under its own attributes. See [`common_attributes.*`](#common_attributes). |
| `types` (required) | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | The types a note can have, by slug: the ones the cascade may yield and a frontmatter may declare. See [`types.*`](#types). |
| `relations` (required) | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | The relations of the meta-model, by slug: their labels, their direction, their cap and the pairs of types they may join. See [`relations.*`](#relations). |
| `confidence` (required) | object | — | — | Confidence of a link by the method that produced it, from 0 to 1; several methods on one link combine as 1 − Π(1 − cᵢ). See [`confidence`](#confidence). |
| `type_prefixes` | map of map of string[] | — | keys: pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`; values: keys: pattern `^[a-z][a-z0-9_]*$` | Words that announce the type of the entity that follows in prose (screen Entity page), by locale then by type slug; a recognised prefix adds type_prefix_bonus and tells which type to expect. |

## `groups.*`

Groups of types, by slug; every type belongs to one.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `label` (required) | object | — | — | Display label of the group, per interface language. See [`groups.*.label`](#groupslabel). |

### `groups.*.label`

A label per interface language; English is the source, French optional.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `en` (required) | string | — | — | Label in English, the source language of the interface. |
| `fr` | string | — | — | Label in French; the English one is used when absent. |

## `common_attributes.*`

An attribute a note may declare in its frontmatter, and what it produces.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `type` (required) | enum | — | `string`, `string[]`, `integer`, `number`, `boolean`, `date`, `enum`, `ref`, `ref[]`, `list` | Kind of value: a scalar, a list of strings (string[]), an enum among values, a reference to one or several entities (ref, ref[]) of the target types, or a list of structured items described by schema. |
| `values` | string[] | — | — | Allowed values of an enum attribute. |
| `default` | any | — | — | Value of the attribute when the note does not set it. |
| `target` | string \| string[] | — | — | Types the referenced entities may have: a type slug, a list of slugs, any, or same for the type of the note itself. |
| `relation` | string | — | pattern `^[a-z][a-z0-9_]*$` | Relation the reference produces, from the note to the referenced entity, at the frontmatter_ref confidence. |
| `inverse` | boolean | `false` | — | Whether the relation goes from the referenced entity to the note instead. |
| `attributes` | object | — | — | Attributes set on the produced relation (mode: read on an accesses relation). |
| `schema` | object | — | — | Shape of each item of a list attribute, by field name: string, ref or another attribute type. |
| `label` | object | — | — | Display label of the attribute, per interface language; the attribute name is shown when absent. Same shape as [`groups.*.label`](#groupslabel). |

## `types.*`

The types a note can have, by slug: the ones the cascade may yield and a frontmatter may declare.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `label` (required) | object | — | — | Display label of the type, per interface language. Same shape as [`groups.*.label`](#groupslabel). |
| `description` | object | — | — | One sentence saying what an entity of the type is, per interface language; the list of a category shows it under its count. Same shape as [`groups.*.label`](#groupslabel). |
| `counted` | object | — | — | The count of a category of the type as an ICU message with a count argument, per interface language: "{count, plural, one {# screen described} other {# screens described}}". Same shape as [`groups.*.label`](#groupslabel). |
| `group` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Slug of the group the type belongs to. |
| `status` | enum | `"active"` | `active`, `planned` | active types are rendered; planned types belong to the meta-model but are not rendered by this version, and a project may activate them. |
| `glyph` | string | — | — | Name of the glyph of the type; the site derives the one-letter mark of the type from its first letter. |
| `graph` | enum | `"full"` | `full`, `documents-only` | How the type enters the graph: full takes part in every relation; documents-only entities (documents, meetings) are only ever the source of a documents relation. |
| `attributes` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | Attributes specific to the type, by name, added to common_attributes. Same shape as [`common_attributes.*`](#common_attributes). |
| `sections` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | H2 sections of a note of this type whose content produces relations, by section key. See [`types.*.sections.*`](#typessections). |
| `display` | object | — | — | What the page of an entity of this type highlights and how its neighbours are ordered. See [`types.*.display`](#typesdisplay). |

### `types.*.sections.*`

An H2 section of a note whose content produces relations.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `heading` (required) | object | — | — | Heading that opens the section, per language; matched without regard to case, accents or whitespace, and the section key itself matches too. Same shape as [`groups.*.label`](#groupslabel). |
| `parse` (required) | enum | — | `ordered-list`, `bullet-list`, `paragraphs`, `table` | Shape of the content of the section: an ordered list, a bullet list, paragraphs or a table. |
| `produces` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Relation slug each recognised mention of the section produces, at the section_mention confidence. |
| `inverse` | boolean | `false` | — | Whether the relation goes from the mentioned entity to the note instead. |
| `attributes` | object | — | — | Attributes set on the produced relation. |

### `types.*.display`

The display rules of a type: the attributes its page highlights and the order of its neighbours.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `highlight` | string[] | — | at most 5 items | Attributes the site puts forward, in order, five at most: the first filters the list of a category of the type and heads its second column, all of them lead the five keys of the panel of an API; the page of an entity shows them in its panel with the others. |
| `neighbours_order` | string[] | — | each: pattern `^[a-z][a-z0-9_]*$` | Neighbour types the neighbourhood panel shows first, in priority order; the types not listed come after, by confidence. Each must be a declared type. |

## `relations.*`

The relations of the meta-model, by slug: their labels, their direction, their cap and the pairs of types they may join.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `label` (required) | object | — | — | Label read from the source of the relation (accesses), per language. Same shape as [`groups.*.label`](#groupslabel). |
| `inverse_label` | object | — | — | Label read from the target of the relation (is accessed by), per language; an undirected relation has none. Same shape as [`groups.*.label`](#groupslabel). |
| `directed` (required) | boolean | — | — | Whether the relation has a direction; an undirected link is stored from the smaller identifier to the larger. |
| `status` | enum | `"active"` | `active`, `planned` | active relations are produced; planned ones belong to the meta-model and wait for a producer. |
| `cap` | number | — | 0 to 1 | Highest confidence a link of this relation can reach, whatever its methods. |
| `target_kind` | enum | `"entity"` | `entity`, `type` | Whether the target of the relation is an entity or a type (applies_to of a standard). |
| `attributes` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | Attributes a link of this relation may carry, by name. Same shape as [`common_attributes.*`](#common_attributes). |
| `allowed` (required) | string[][] | — | at least 1 item; each: exactly 2 items; each: each: pattern `^([a-z][a-z0-9_]*\|any\|same\|type)$` | Pairs of types the relation may join, source then target. any matches every type, same requires both ends of one type, type marks a target that is a type rather than an entity. A project profile adds pairs to the default ones. |

## `confidence`

Confidence of a link by the method that produced it, from 0 to 1; several methods on one link combine as 1 − Π(1 − cᵢ).

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `explicit_link` | number | — | 0 to 1 | A markdown link written in a note. |
| `lock_promoted` | number | — | 0 to 1 | A link promoted in the lock file; no producer in this version. |
| `contract_import` | number | — | 0 to 1 | A link read from an imported interface contract (an API exposes an endpoint). |
| `frontmatter_ref` | number | — | 0 to 1 | A reference declared by a frontmatter attribute. |
| `folder_zone` | number | — | 0 to 1 | A link deduced from where a note is filed; no producer in this version. |
| `section_mention` | number | — | 0 to 1 | A mention under a section mapped in the profile. |
| `glossary_occurrence` | object | — | — | A mention of a title or alias in prose: base, raised by per_occurrence for each further occurrence up to cap, multiplied by homonym_factor for a homonym, raised by type_prefix_bonus after a recognised type prefix. See [`confidence.glossary_occurrence`](#confidenceglossary_occurrence). |
| `cooccurrence` | number | — | 0 to 1 | Two entities mentioned in the same paragraph. |
| `embedding` | number | — | 0 to 1 | Semantic similarity; no producer in this version. |

### `confidence.glossary_occurrence`

A mention of a title or alias in prose: base, raised by per_occurrence for each further occurrence up to cap, multiplied by homonym_factor for a homonym, raised by type_prefix_bonus after a recognised type prefix.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `base` (required) | number | — | 0 to 1 | Confidence of the first occurrence. |
| `per_occurrence` (required) | number | — | 0 to 1 | Added for each further occurrence in the same note. |
| `cap` (required) | number | — | 0 to 1 | Highest confidence occurrences alone can reach. |
| `homonym_factor` | number | — | 0 to 1 | Factor applied when the form names several entities. |
| `type_prefix_bonus` | number | — | 0 to 1 | Added when a type prefix announces the mention. |
