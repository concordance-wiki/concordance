# Writing notes

Concordance reads your markdown as it is. You do not have to change anything to get a site: every word that appears often enough gets a page made of the passages that use it. Writing notes makes the site richer, one file at a time.

## A note is a markdown file with a title

```markdown
# Keyword page

A page generated for every expression that crosses the publication threshold, whether or not a note defines it.
```

The H1 is the title. The first paragraph is the summary. The file path gives the identifier: `glossary/keyword-page.md` in the source `glossary` becomes `glossary/keyword-page`, and its page URL follows (`glossary/keyword-page/`). Folder and file names are slugified: `Réglementation générale.md` becomes `reglementation-generale`. An `id:` in frontmatter overrides the path; it must be lowercase letters, digits and hyphens with at least one `/`, such as `specs/rules/publication-threshold`.

## Type by filing, not by editing

The type of a note comes from where it is filed. The integrator declares the rules in the configuration: everything under `screens/` is a screen, every `.rule.md` is a rule, everything in the glossary repository is a term. You write the file in the right folder and it is typed.

When you need to be explicit, frontmatter wins over the filing rules:

```markdown
---
type: screen
roles: [reader]
---
# Entity page
```

A `type` that contradicts the file suffix is reported (`E-TYPE-CONFLICT`) rather than guessed; the frontmatter is kept. A `type` the profile does not declare is reported too (`W-TYPE-UNKNOWN`) and the note is treated as a document. The entity records where its type came from (`type_origin`: the source, `rule#3`, the suffix or the frontmatter).

## Frontmatter: what qualifies, nothing more

Frontmatter carries what qualifies the note, at most a handful of keys. The site shows up to five of them next to the title; the rest goes to the side panel. The [templates](../templates/README.md) list the keys of each type.

Common keys: `title` (overrides the H1), `aliases` (other names, used for recognition), `application`, `domain`, `status` (`draft`, `proposed`, `valid`, `obsolete`), `tags`, `summary`, `superseded_by`. A key that neither the type nor the common attributes declare is kept as-is and reported (`W-ATTRIBUTE-UNKNOWN`).

`application` and `domain` file the note where the configuration would not. The application otherwise comes from the source or from a typing rule; the domain otherwise comes from the folders and globs the integrator declares globally, across every source. A frontmatter value wins over both, and names a domain by its identifier (`recognition`) or by its identifier path (`inference/recognition`). A note that nothing files goes to the `unclassified` domain (`W-DOMAIN-UNCLASSIFIED`) or has no application (`W-APP-MISSING`); a value the configuration does not declare is kept as written and reported (`W-DOMAIN-UNKNOWN`, `W-APP-UNKNOWN`).

Reference keys (`reads`, `writes`, `rules`, `roles`, `consumers`, `affects`, `broader`, `business_object`) accept one value or a list of values and produce the relation the profile attaches to the key at confidence 0.90, method `frontmatter_ref`, with the key name as provenance: `reads: [objects/entity]` on a screen gives `accesses` in `read` mode, `roles: [roles/reader]` gives `assigned_to` from the role to the screen. Each value is resolved in this order, the first match winning:

1. by identifier: the full identifier (`specs/roles/reader`), or the identifier relative to the source of the note (`roles/reader`);
2. by path relative to the source root, extension included (`roles/reader.md`, `rules/publication-threshold.rule.md`); a path written differently from the file name resolves through the identifier it derives (`Roles/Reader.md`);
3. by exact title, after trimming, case-sensitively (`Publication threshold`).

A value that matches nothing or a title shared by several notes is reported (`W-REF-UNRESOLVED`) and gives no link; a note of a type the key does not accept (a rule under `reads`) gives a link that the relation typing step drops with `E-META-REL`. Several values naming the same note give one link with one provenance per value.

## Links are authoritative

A markdown link to another note is the strongest relation the tool knows: confidence 1.00, above anything inferred.

```markdown
The count is checked against the [publication threshold](../rules/publication-threshold.rule.md).
```

Links are relative to the file, then to the source root. A link to a missing file is an error (`E-LINK-BROKEN`); a link to a non-markdown file (a slide deck, a PDF) attaches that document to the note. The provenance of the link records the file, the line, the link text and the anchor when one is written; several links from one note to the same target are one link with several provenances. A link from a note to itself, such as a table of contents, yields nothing.

A link can reach another source with the `<source>:<path>` prefix, the path being relative to the root of that source:

```markdown
See [static site with islands](decisions:static-site-with-islands.md).
```

A relative link that climbs above the source root into a sibling source (`../decisions/static-site-with-islands.md` from a source that is a folder next to `decisions/`) counts as the same thing. Both resolve only when `inference.cross_source_links` is `true` in `concordance.yaml`; otherwise the link is flagged (`W-LINK-CROSS-SOURCE`) and not recorded.

## An API note declares its contract

An `api` note names its contract in the `contract` attribute, as a URL or as a path relative to the note:

```markdown
---
type: api
protocol: rest
contract: ./model-query.openapi.json
---
# Model query API
```

With the `contract-openapi` plugin declared in the configuration, the build reads the OpenAPI 3.x document and produces one operation per path and method, linked to the API at confidence 0.95 with the contract location and the operation name as provenance: the operations are never copied into the note. The schemas the contract references are offered as candidate objects, not linked. The version the contract declares is recorded with its import date and, for a contract kept next to the note, the date of its last commit, which the page of the API shows. A contract that cannot be fetched, read or parsed is reported (`W-CONTRACT-UNREACHABLE`) and the note keeps the operations written by hand; the build goes on.

The same attribute accepts a WSDL, so that a SOAP service is inventoried like the others:

```markdown
---
type: api
protocol: soap
contract: https://legacy.example.invalid/forge-bridge?wsdl
---
# Forge bridge
```

With the `contract-wsdl` plugin declared, the build reads the WSDL 1.1 or 2.0 document and produces one operation per port type operation, titled `operation (port)`, with its port, binding and SOAP action; the XSD elements and types its messages reference are offered as candidate objects. The plugins tell the two formats apart by content, not by extension: an XML document whose root is `definitions` or `description` goes to the WSDL plugin, anything else to the OpenAPI plugin. An operation imported from either carries `operation_id`, `summary` and `style` (`http` or `soap`) and is handled the same way afterwards.

## Operation notes

An operation deserves a note when there is business to explain where it happens: write one `endpoint` note per operation and let the build attach it to the operation imported from the contract. The note names its API in the `api` attribute (an identifier, a path relative to the source root or the exact title of the API note) and the operation it describes:

```markdown
---
type: endpoint
api: api/model-query
operation_id: listEntities
---
# List the entities

Returns the [entities](../objects/entity.md) of the last build, in identifier order.

## Consumers

- [Pinned trail](../screens/pinned-trail.md)

## Rules

- [Identifier pattern](../rules/identifier-pattern.rule.md)
```

The matching tries three rungs in order and stops at the first that matches: the `operation_id` of the frontmatter against the operation identifier of the contract; then the `method` and `path` pair (the method compared without case) against the operation's, or `port` and the title against the port and operation name of a SOAP operation; then the title of the note in comparison form, spaces and punctuation ignored, against the operation title or its identifier (`List entities` matches `listEntities`). A note without `api` is a candidate for every API of its source that declares a contract; a markdown link to the API note also names it. The first rung is the one to rely on: it survives a renamed path and a retitled note.

A matched note absorbs the operation. The page shows the note's markdown and the properties the contract declares: `method`, `path`, `summary` and `style` for an HTTP operation, `port`, `binding` and `soap_action` for a SOAP one, added under the note's own frontmatter when the note does not set them. The contract appears as a representation of the note next to its markdown, `grouped_by` names the rung, and the `exposes` link of the API points at the note; the imported operation no longer exists as a separate entity. Everything else works as for any note: the frontmatter references, the `## Consumers` and `## Rules` sections, the markdown links in the text and the mentions of glossary terms produce the note's own links (`serves`, `constrains`, `accesses`, `explicit_link`).

Two notes claiming the same operation, or one note matching several operations of its API, is an ambiguity: the build reports [`W-OPERATION-AMBIGUOUS`](../checks/W-OPERATION-AMBIGUOUS.md) naming every candidate and attaches nothing.

The gap between the contract and the notes is measured in both directions. A note that names an API with an imported contract and matches none of its operations stays an ordinary `endpoint` note and is reported as [`W-OPERATION-UNMATCHED`](../checks/W-OPERATION-UNMATCHED.md): either the operation disappeared from the contract, and the note should go or point at its replacement, or the note is ahead of the contract, and it is right to keep it until the contract catches up. A note that names no API is not reported: it may describe an API without a contract. In the other direction, the page of the API lists every operation of its contract and flags the ones no note describes yet, with their count: the documentation debt of the API, readable on its page.

## Sections that mean something

Some section headings are mapped to relations in the profile. A mention under such a heading counts more (0.70, method `section_mention`, with the section and the line as provenance) than a mention in a paragraph (0.60, method `glossary_occurrence`, with the line as provenance).

| Type | Sections |
|---|---|
| screen | `## Objects` (accesses), `## Actions` (triggers), `## Rules` (constrains) |
| process | `## Steps` (ordered list of steps) |
| api | `## Consumers` (serves), `## Objects` (accesses) |
| endpoint | `## Consumers` (serves), `## Rules` (constrains) |
| batch | `## Reads`, `## Writes` (accesses) |
| rule | `## Applies to` (constrains) |
| decision | `## Affects` (affects) |

A heading is matched against the labels of every locale of the profile and against the section key itself, whatever the locale of the source: `## Objects`, `## Objets` and `## objects` all map to the `objects` section of a screen. The comparison ignores case, accents and surrounding or repeated whitespace (`## OBJECTS`, `## Regles`, `## S'APPLIQUE A`), and nothing else: `## Objects and more` maps to nothing. Only the H2 sections of the note count, and the mapping is that of the type of the note: `## Applies to` under a screen, or `## Objects` under a rule, is an ordinary section.

Under a mapped section, every recognised mention of another note gives the declared relation from the note to the mentioned entity, or the other way round when the profile marks the section `inverse` (a rule listed under `## Rules` of a screen constrains the screen), with the attributes of the section (`## Writes` of a batch gives `accesses` in `write` mode). A mention whose two types the relation does not join, such as a glossary term listed under `## Objects`, counts as a plain mention. A note that mentions itself gives no link. Outside a mapped section, or when the section relation does not apply, the mention gives a `related` link at 0.60 until the relation typing step refines it; `related` being undirected, that link goes from the smaller identifier to the larger, so that two notes mentioning each other share one link. Several mentions of the same note in the same relation make one link with one provenance per mention.

## How a relation gets its name

Every link between two notes ends up with a relation of the profile, decided on four rungs, the first that applies winning:

1. a mapped section: the mention of a business object under `## Objects` of a screen is `accesses`;
2. a typed frontmatter attribute: `reads: [objects/entity]` is `accesses` in `read` mode, `roles: [roles/maintainer]` is `assigned_to` from the role;
3. a type pair admitting a single relation: a markdown link or a plain mention between a rule and a screen is `constrains`, because the profile allows nothing else between these two types besides `related`; the link carries `relation_origin: pair` so that a reader can tell a guess from a declaration, and it is turned around when the profile only allows the relation the other way (the screen that links to the rule ends up constrained by it);
4. `related`, when the pair admits no relation or several: the link is kept, its confidence capped at 0.60 whatever the methods behind it, and an `I-REL-AMBIGUOUS` finding points at the file and line of its first provenance that names a file.

The first two rungs are decided by what you wrote and the tool never overturns them; when a section or a frontmatter attribute names a relation the profile does not allow between the two types, the link is dropped with an `E-META-REL` finding rather than replaced. A pair-named link and a declared link that say the same thing merge into one, with every provenance and without the marker. The labels the site shows for a relation, read from the source (`accesses`) or from the target (`is accessed by`), come from the profile alone (`label`, `inverse_label`).

## What is not read

Fenced and indented code blocks, inline code, URLs (bare, autolinked or written as `www.`), raw HTML, frontmatter values, link targets and images are never scanned for words: a variable name in a code block never becomes a business mention. Everything else is read, one unit at a time: headings of every level (the H1 title included), paragraphs, list items (nested items separately), table cells and the paragraphs of block quotes. The visible text of a markdown link stays subject to recognition: in a link written as "publication threshold" pointing to the rule note, "publication threshold" is read and the target path is not. Every mention keeps the line where its unit starts and the H2 section that encloses it. The excerpt a mention is quoted with is the unit as written: inline code is not read, but it stays in the excerpt (`inference.short_terms` reads as such in a passage), so that an excerpt never shows a hole where a code span stood.

## Documents and meetings

A markdown file that no rule types is a document. It is indexed, its words are recorded, and it appears in the mentions of every note it cites, but it is not a node of the model. Meeting notes and transcripts behave the same way; the decisions they contain deserve their own `decision` note, linked to the meeting.

A transcript names the people who spoke. Before it is rendered or indexed, speaker names and the real names of the pseudonymisation dictionary are replaced by pseudonyms, and a name pattern found outside the dictionary is reported as `I-PII-DETECTED` for you to add to the dictionary or to edit out of the source. Transcripts are published only when the configuration asks for it; see the [privacy section of the configuration guide](configuration.md#pseudonymisation).

## Glossary terms

A term note is short: a definition, aliases, and, when useful, a broader term.

```markdown
---
aliases: [word page]
broader: page
---
# Keyword page

A page generated for every expression that crosses the publication threshold.
```

Spellings are compared without regard to case, accents or the plural: "Keyword Page", "keyword pages" and "keyword page" are one term, in every language pack the engine ships. Hyphens and apostrophes stay part of the word, and a term is only recognised on word boundaries: "source" is not found inside "resource". A mention is recognised on whole words, an expression contained in a longer recognised expression is not counted twice ("keyword page" counts once, not as "keyword page" plus "page"; "build log summary" still counts both "build log" and "log summary" when each has a note), and a type prefix written right before it ("screen Entity page", "l'écran Page entité"; the words are listed per locale under `type_prefixes` in the profile) raises its confidence by 0.10 and tells the tool which type of note to expect.

Two entities with the same title or alias, once spellings are compared, are homonyms: a glossary term and a business object both called "Source", or two terms whose aliases meet. The tool keeps both, reports `I-TERM-HOMONYM` with the form and the entities, and links every occurrence to each entity at half confidence, glossary entities first; a `## Not to be confused with` section helps readers. Aliases shorter than three characters (`id`) are ignored unless `inference.short_terms` lists them, and a title or alias that is a stopword of the language is never recognised.

## Profile

A project profile (`profile.yaml`) adds types, attributes, relations with their labels in both directions (`label`, `inverse_label`), relation pairs and mapped sections on top of the default profile, key by key, without any code change. The [default profile](../../packages/profile/default.yaml) is the reference; [`profile.schema.json`](../../packages/core/schemas/profile.schema.json) validates it. A type can also be written as a [type module](adding-a-type.md), a folder carrying its declaration, its labels and its template: `types_dir` names a folder of such modules, relative to `profile.yaml`, merged before the keys of the profile itself, and the plugins declared in `concordance.yaml` contribute modules the same way. The order is fixed: the default profile, the modules of the plugins in declaration order, the modules of `types_dir`, then the keys of `profile.yaml`; a module of a type the default profile already declares is a configuration error (extend that type under `types` instead), and so are two modules of one type.

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

Under `display`, a type declares what its page highlights and how its neighbours are ordered. `highlight` names the attributes shown as qualifiers next to the title. `neighbours_order` lists, in priority order, the neighbour types the neighbourhood panel of the type shows first: `api: [endpoint, screen, business_object, rule, decision]` puts the operations before the screens an API serves; `screen: [business_object, data_object, screen, api, rule, process]` puts the accessed objects first; `rule: [screen, process, api, business_object, decision]` puts what the rule applies to first. Within a group neighbours come by decreasing confidence, the types the list does not name (keyword pages among them) come after every listed one, and the panel is truncated after this ordering. A type without `neighbours_order` lists its neighbours by decreasing confidence alone. Every type named in a `neighbours_order` must be declared in the profile; the validation reports the others at their path.

Merge semantics: objects are merged key by key at every depth, so a project can add a type, add or complete an attribute of an existing type, or translate a label without repeating the rest. A scalar or an array in the project profile replaces the default value (`display.highlight`, `values`, `neighbours_order`); the only exception is `allowed` under a relation, where the project pairs are added to the default pairs, so that `constrains` above still applies to rules. The merged profile is validated against the schema, then every slug it names must be declared: the group of a type, the relation an attribute or a mapped section produces, the types of an allowed pair (`any`, `same` and `type` are the wildcards). A fingerprint of the merged profile is recorded in the model, so that two builds can be compared.

## Check before pushing

```bash
npx concordance lint --scope repo
```

The linter reports broken links, duplicate identifiers, invalid frontmatter, type conflicts and missing sections, with a link to the [page of each check](../checks/README.md).

`--fix` applies the safe corrections and prints each of them before writing: it adds the `type` the filing rules deduce to a frontmatter that has none, orders the frontmatter keys (`id`, `type`, `title`, `aliases`, `status`, then the rest alphabetically) and points a link to a missing file at the only file carrying that name. It refuses, and says so, when several files carry the name; it leaves an invalid frontmatter and a note without frontmatter as they are; it never writes an inferred link and never touches the body of a note. `--dry-run` lists the corrections without writing. See the [getting started guide](command-line.md#safe-fixes).
