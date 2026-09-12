# Writing notes

Concordance reads your markdown as it is. You do not have to change anything to get a site: every word that appears often enough gets a page made of the passages that use it. Writing notes makes the site richer, one file at a time.

## A note is a markdown file with a title

```markdown
# Free payment

A payment made at the member's request, outside any schedule, on a running contract.
```

The H1 is the title. The first paragraph is the summary. The file path gives the identifier: `glossary/free-payment.md` in the source `glossary` becomes `glossary/free-payment`, and its page URL follows.

## Type by filing, not by editing

The type of a note comes from where it is filed. The integrator declares the rules in the configuration: everything under `screens/` is a screen, every `.rule.md` is a rule, everything in the glossary repository is a term. You write the file in the right folder and it is typed.

When you need to be explicit, frontmatter wins over the filing rules:

```markdown
---
type: screen
roles: [account-manager]
---
# Free payment entry
```

A `type` that contradicts the file suffix is reported (`E-TYPE-CONFLICT`) rather than guessed.

## Frontmatter: what qualifies, nothing more

Frontmatter carries what qualifies the note, at most a handful of keys. The site shows up to five of them next to the title; the rest goes to the side panel. The [templates](../templates/README.md) list the keys of each type.

Common keys: `title` (overrides the H1), `aliases` (other names, used for recognition), `application`, `domain`, `status` (`draft`, `proposed`, `valid`, `obsolete`), `tags`, `summary`, `superseded_by`.

Reference keys (`reads`, `writes`, `rules`, `roles`, `consumers`, `affects`) accept an identifier, a path or an exact title, and produce a typed relation at confidence 0.90.

## Links are authoritative

A markdown link to another note is the strongest relation the tool knows: confidence 1.00, above anything inferred.

```markdown
The amount is checked against the [annual cap](../rules/annual-cap.rule.md).
```

Links are relative to the file, then to the source root. A link to a missing file is an error (`E-LINK-BROKEN`); a link to a non-markdown file (a slide deck, a PDF) attaches that document to the note.

## Sections that mean something

Some section headings are mapped to relations in the profile. A mention under such a heading counts more (0.70) than a mention in a paragraph (0.60).

| Type | Sections |
|---|---|
| screen | `## Objects` (accesses), `## Actions` (triggers), `## Rules` (constrains) |
| process | `## Steps` (ordered list of steps) |
| api | `## Consumers` (serves), `## Objects` (accesses) |
| batch | `## Reads`, `## Writes` (accesses) |
| rule | `## Applies to` (constrains) |
| decision | `## Affects` (affects) |

French headings (`## Objets`, `## Étapes`, `## Règles`) are recognised in sources whose locale is `fr`.

## What is not read

Code blocks, inline code, URLs, frontmatter values and link targets are never scanned for words. A variable name in a code block never becomes a business mention.

## Documents and meetings

A markdown file that no rule types is a document. It is indexed, its words are recorded, and it appears in the mentions of every note it cites, but it is not a node of the model. Meeting notes and transcripts behave the same way; the decisions they contain deserve their own `decision` note, linked to the meeting.

## Glossary terms

A term note is short: a definition, aliases, and, when useful, a broader term.

```markdown
---
aliases: [FP, free contribution]
broader: payment
---
# Free payment

A payment made at the member's request, outside any schedule.
```

Two notes with the same title are homonyms. The tool keeps both and links occurrences to each at half confidence; a `## Not to be confused with` section helps readers.

## Profile

A project profile (`profile.yaml`) adds types, attributes, relation pairs and mapped sections on top of the default profile, key by key, without any code change. The [default profile](../../packages/profile/default.yaml) is the reference; [`profile.schema.json`](../../packages/core/schemas/profile.schema.json) validates it.

```yaml
types:
  regulation:
    label: { en: Regulation, fr: Réglementation }
    group: motivation
    attributes:
      reference: { type: string }
    sections:
      applies_to:
        heading: { en: "Applies to", fr: "S'applique à" }
        parse: bullet-list
        produces: constrains
relations:
  constrains:
    allowed:
      - [regulation, process]
```

Merge semantics: objects are merged key by key at every depth, so a project can add a type, add or complete an attribute of an existing type, or translate a label without repeating the rest. A scalar or an array in the project profile replaces the default value (`display.highlight`, `values`, `neighbours_order`); the only exception is `allowed` under a relation, where the project pairs are added to the default pairs, so that `constrains` above still applies to rules. The merged profile is validated against the schema, then every slug it names must be declared: the group of a type, the relation an attribute or a mapped section produces, the types of an allowed pair (`any`, `same` and `type` are the wildcards). A fingerprint of the merged profile is recorded in the model, so that two builds can be compared.

## Check before pushing

```bash
npx concordance lint --scope repo
```

The linter reports broken links, duplicate identifiers, invalid frontmatter, type conflicts and missing sections, with a link to the [page of each check](../checks/README.md). `--fix` applies the safe corrections (frontmatter normalisation, key order, deduced type); it never writes an inferred link.
