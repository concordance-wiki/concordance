# Type module reference

Every key of `type.yaml`, generated from [`type-module.schema.json`](../../packages/core/schemas/type-module.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/adding-a-type.md) explains how the keys work together.

Schema of type.yaml, the declaration of a type module. A module is a folder types/<slug>/ holding type.yaml, template.md (the note template), messages/<locale>.json (the labels of the type, its attributes and its sections, in the format of the interface catalogues), optionally schema.json (a JSON Schema of the items of its list attributes, by attribute name) and components/ (rendering overrides: EntityPage, Attribute@<name>, Section@<key>). The slug is the folder name; the labels live in the messages, never here.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `group` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Slug of the group the type belongs to; a group of the profile the module is merged into. |
| `status` | enum | `"active"` | `active`, `planned` | active types are rendered; planned types belong to the meta-model but are not rendered by this version, and a project may activate them. |
| `glyph` | string | — | — | Name of the glyph of the type; the site derives the one-letter mark of the type from its first letter. |
| `graph` | enum | `"full"` | `full`, `documents-only` | How the type enters the graph: full takes part in every relation; documents-only entities are only ever the source of a documents relation. |
| `attributes` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | Attributes specific to the type, by name, added to the common attributes of the profile; their labels are the attributes.<name> messages. See [`attributes.*`](#attributes). |
| `sections` | map of object | — | keys: pattern `^[a-z][a-z0-9_]*$` | H2 sections of a note of this type whose content produces relations, by section key; their headings are the sections.<key> messages. See [`sections.*`](#sections). |
| `display` | object | — | — | What the page of an entity of this type highlights and how its neighbours are ordered. See [`display`](#display). |

## `attributes.*`

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
| `label` | object | — | — | Display label of the attribute, per interface language; the attribute name is shown when absent. See [`attributes.*.label`](#attributeslabel). |

### `attributes.*.label`

A label per interface language; English is the source, French optional.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `en` (required) | string | — | — | Label in English, the source language of the interface. |
| `fr` | string | — | — | Label in French; the English one is used when absent. |

## `sections.*`

H2 sections of a note of this type whose content produces relations, by section key; their headings are the sections.<key> messages.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `parse` (required) | enum | — | `ordered-list`, `bullet-list`, `paragraphs`, `table` | Shape of the content of the section: an ordered list, a bullet list, paragraphs or a table. |
| `produces` (required) | string | — | pattern `^[a-z][a-z0-9_]*$` | Relation slug each recognised mention of the section produces, at the section_mention confidence. |
| `inverse` | boolean | `false` | — | Whether the relation goes from the mentioned entity to the note instead. |
| `attributes` | object | — | — | Attributes set on the produced relation. |

## `display`

The display rules of a type: the attributes its page highlights and the order of its neighbours.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `highlight` | string[] | — | at most 5 items | Attributes shown next to the type badge of the page, in order, five at most. |
| `neighbours_order` | string[] | — | each: pattern `^[a-z][a-z0-9_]*$` | Neighbour types the neighbourhood panel shows first, in priority order; the types not listed come after, by confidence. Each must be a declared type. |
