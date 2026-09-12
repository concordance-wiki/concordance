# Writing notes

Concordance reads your markdown as it is. You do not have to change anything to get a site: every word that appears often enough gets a page made of the passages that use it. Writing notes makes the site richer, one file at a time.

## A note is a markdown file with a title

```markdown
# Free payment

A payment made at the member's request, outside any schedule, on a running contract.
```

The H1 is the title. The first paragraph is the summary. The file path gives the identifier: `glossary/free-payment.md` in the source `glossary` becomes `glossary/free-payment`, and its page URL follows (`glossary/free-payment/`). Folder and file names are slugified: `Réglementation générale.md` becomes `reglementation-generale`. An `id:` in frontmatter overrides the path; it must be lowercase letters, digits and hyphens with at least one `/`, such as `specs/rules/annual-cap`.

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

A `type` that contradicts the file suffix is reported (`E-TYPE-CONFLICT`) rather than guessed; the frontmatter is kept. A `type` the profile does not declare is reported too (`W-TYPE-UNKNOWN`) and the note is treated as a document. The entity records where its type came from (`type_origin`: the source, `rule#3`, the suffix or the frontmatter).

## Frontmatter: what qualifies, nothing more

Frontmatter carries what qualifies the note, at most a handful of keys. The site shows up to five of them next to the title; the rest goes to the side panel. The [templates](../templates/README.md) list the keys of each type.

Common keys: `title` (overrides the H1), `aliases` (other names, used for recognition), `application`, `domain`, `status` (`draft`, `proposed`, `valid`, `obsolete`), `tags`, `summary`, `superseded_by`. A key that neither the type nor the common attributes declare is kept as-is and reported (`W-ATTRIBUTE-UNKNOWN`).

Reference keys (`reads`, `writes`, `rules`, `roles`, `consumers`, `affects`) accept an identifier, a path or an exact title, and produce a typed relation at confidence 0.90.

## Links are authoritative

A markdown link to another note is the strongest relation the tool knows: confidence 1.00, above anything inferred.

```markdown
The amount is checked against the [annual cap](../rules/annual-cap.rule.md).
```

Links are relative to the file, then to the source root. A link to a missing file is an error (`E-LINK-BROKEN`); a link to a non-markdown file (a slide deck, a PDF) attaches that document to the note. The provenance of the link records the file, the line, the link text and the anchor when one is written; several links from one note to the same target are one link with several provenances. A link from a note to itself, such as a table of contents, yields nothing.

A link can reach another source with the `<source>:<path>` prefix, the path being relative to the root of that source:

```markdown
See [cap checked server-side](decisions:cap-checked-server-side.md).
```

A relative link that climbs above the source root into a sibling source (`../decisions/cap-checked-server-side.md` from a source that is a folder next to `decisions/`) counts as the same thing. Both resolve only when `inference.cross_source_links` is `true` in `concordance.yaml`; otherwise the link is flagged (`W-LINK-CROSS-SOURCE`) and not recorded.

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

A transcript names the people who spoke. Before it is rendered or indexed, speaker names and the real names of the pseudonymisation dictionary are replaced by pseudonyms, and a name pattern found outside the dictionary is reported as `I-PII-DETECTED` for you to add to the dictionary or to edit out of the source. Transcripts are published only when the configuration asks for it; see the [privacy section of the configuration guide](configuration.md#pseudonymisation).

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

Spellings are compared without regard to case, accents or the plural: "Free Payment", "free payments" and "free payment" are one term, in every language pack the engine ships. Hyphens and apostrophes stay part of the word, and a term is only recognised on word boundaries: "contract" is not found inside "contractual".

Two entities with the same title or alias, once spellings are compared, are homonyms: a glossary term and a business object both called "Contract", or two terms whose aliases meet. The tool keeps both, reports `I-TERM-HOMONYM` with the form and the entities, and links every occurrence to each entity at half confidence, glossary entities first; a `## Not to be confused with` section helps readers. Aliases shorter than three characters (`FP`) are ignored unless `inference.short_terms` lists them, and a title or alias that is a stopword of the language is never recognised.

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
