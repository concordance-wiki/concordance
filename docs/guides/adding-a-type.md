# Adding a type

The engine knows nothing about screens, rules or runbooks: it reads a profile. A type of the profile is written as a **type module**, a folder that carries everything the type needs, its declaration, its labels in every language, its note template and, when the generic page is not enough, its rendering. The core types of Concordance are such modules, under [`packages/profile/types/`](../../packages/profile/types/); the default profile is assembled from them. A team declares its own types the same way, in a folder of its configuration repository or in a plugin it publishes, without touching the engine.

This guide gives the format, walks through a complete example, a runbook for operating Concordance, and says how to ship the module. The keys of `type.yaml` are listed in the [type module reference](../reference/type-module.md); the [writing notes guide](writing-notes.md#profile) explains what a profile is and how a project profile is merged.

## The module format

A module is a folder named after the type slug (lowercase letters, digits and underscores, starting with a letter), under a `types/` folder:

```text
types/runbook/
├── type.yaml            the declaration: group, glyph, attributes, mapped sections, display
├── template.md          the note template, copied by concordance init --templates
├── messages/
│   ├── en.json          the labels of the type, its attributes and its sections (source language)
│   └── fr.json          the same labels in French
├── schema.json          optional: a JSON Schema of the items of each list attribute
└── components/          optional: rendering overrides, see the theming guide
    ├── EntityPage.js
    ├── Attribute@steps.js
    └── Section@steps.js
```

| File | Required | What it holds |
|---|---|---|
| `type.yaml` | yes | what the [profile](../reference/profile.md#types) declares for a type, without its labels: `group`, `status`, `glyph`, `graph`, `attributes`, `sections` (each with `parse`, `produces`, `inverse`, `attributes`, and no `heading`) and `display`. Validated by [`type-module.schema.json`](../../packages/core/schemas/type-module.schema.json). |
| `messages/en.json` | yes | the labels, in the format of the interface catalogues of `@concordance-wiki/i18n`: `label` for the type, `attributes.<name>` for each attribute, `sections.<key>` for each mapped section, each entry `{ "defaultMessage": "...", "description": "..." }`. `label` and every `sections.<key>` are required; an attribute without a message is labelled by its name. |
| `messages/<language>.json` | no | a flat translation, `{ "<key>": "..." }`, for each other language of the interface (`fr` ships). |
| `template.md` | for an active type | the note template: a note of the type, frontmatter first, that the linter accepts. |
| `schema.json` | no | an object keyed by attribute name whose values are JSON Schemas of the items of that `list` attribute; a key naming an attribute that is not a `list` is an error. It becomes the `schema` of the attribute in the assembled profile. |
| `components/` | no | one module file per override: `EntityPage`, `Attribute@<name>` or `Section@<key>`, default export a Preact component; any other name is an error. |

The messages are plain ICU MessageFormat strings without variables; the profile keeps, for every label, the source message and the translations the module ships (`{ en, fr }`). Every problem of a module is reported at once with the file it comes from: a `type.yaml` key against the schema, a message naming an attribute the module does not declare, a component with a name the module cannot provide.

Once merged into the profile, a module is a type like any other: its `group` must be a group of the profile, the relations its attributes and sections produce must be declared, and the types its `display.neighbours_order` names must exist. A project profile can still extend it (`types.<slug>` in `profile.yaml`), key by key, as it extends a core type.

## A complete example

A runbook is a procedure a maintainer follows to operate Concordance: rebuilding the site after a red build, pruning the cache, reviewing detected personal data. It has a trigger, a list of steps that name the checks and screens involved, and the rule that constrains it.

`types/runbook/type.yaml`:

```yaml
group: quality
glyph: runbook
attributes:
  trigger: { type: string }
  owner: { type: ref, target: role, relation: assigned_to, inverse: true }
  steps: { type: list }
  rules: { type: "ref[]", target: rule, relation: constrains, inverse: true }
sections:
  steps:
    parse: ordered-list
    produces: related
  rules:
    parse: bullet-list
    produces: constrains
    inverse: true
display:
  highlight: [trigger, owner]
  neighbours_order: [rule, screen, batch, process]
```

`types/runbook/messages/en.json`:

```json
{
  "attributes.owner": { "defaultMessage": "Owner", "description": "Role that runs the runbook." },
  "attributes.rules": { "defaultMessage": "Rules", "description": "Rules the runbook obeys." },
  "attributes.steps": { "defaultMessage": "Steps", "description": "The ordered steps." },
  "attributes.trigger": { "defaultMessage": "Trigger", "description": "What starts the runbook." },
  "label": { "defaultMessage": "Runbook", "description": "Label of the runbook type." },
  "sections.rules": { "defaultMessage": "Rules", "description": "Heading of the rules section." },
  "sections.steps": { "defaultMessage": "Steps", "description": "Heading of the steps section." }
}
```

`types/runbook/messages/fr.json`:

```json
{
  "attributes.owner": "Responsable",
  "attributes.rules": "Règles",
  "attributes.steps": "Étapes",
  "attributes.trigger": "Déclencheur",
  "label": "Procédure",
  "sections.rules": "Règles",
  "sections.steps": "Étapes"
}
```

`types/runbook/schema.json`, the shape of each step:

```json
{
  "steps": {
    "type": "object",
    "required": ["action"],
    "properties": { "action": { "type": "string" }, "check": { "type": "string" } }
  }
}
```

`types/runbook/template.md`:

```markdown
---
type: runbook
trigger: a red nightly build
owner: roles/maintainer
status: valid
---
# Rebuild the site after a red build

## Steps

1. Read the [build log](../objects/build.md) and the findings it lists.
2. Fix the notes the errors point at, then run `concordance lint`.
3. Run `concordance build` again and check the [home page](../screens/home-page.md).

## Rules

- [Fail-on policy](../rules/fail-on-policy.md)
```

The `## Steps` section produces `related` links to every note it mentions, `## Rules` makes each listed rule constrain the runbook, `owner` assigns the role, and the page of a runbook highlights its trigger and its owner, lists its rules first among its neighbours, and shows every other attribute in its panel. Nothing else is needed for the generic page to render a runbook; the [theming guide](theming.md#rendering-per-type) says how to give it a page of its own.

## The core types

The types the engine ships are modules under `packages/profile/types/`, and [`packages/profile/default.yaml`](../../packages/profile/default.yaml) is assembled from them and from `base.yaml` (the groups, the common attributes, the relations, the confidence scale and the type prefixes) by `node scripts/assemble-profile.mjs`; `pnpm lint` fails when the committed profile differs from the assembly, and the profile package tests check that its own reader assembles the same profile. The note templates of [`docs/templates`](../templates/README.md) and of the command line are copied from the modules by `node scripts/sync-templates.mjs`. To change a core type, edit its module and run both scripts.
