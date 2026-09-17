# Configuration

Everything lives in a configuration repository: `concordance.yaml`, an optional `profile.yaml`, a `theme.yaml`, stopword files, `concordance.lock.yaml`, and, never versioned in a public repository, `pseudonyms.yaml`. `concordance validate-config` checks `concordance.yaml` against [`config.schema.json`](../../packages/core/schemas/config.schema.json) and prints the path of any faulty key, the value received and the values expected, then a verdict line. Exit codes: 0 valid, 1 invalid, 2 file not found. Beyond the schema, it rejects a source name used twice, a malformed domain glob and pseudonymisation enabled without a dictionary, and it warns about what is accepted but ignored in this version (the `links` of the lock file, tracker sources) and about transcripts published without pseudonymisation. `--config` (or `-c`) points at another file; the default is `concordance.yaml` in the current directory.

This guide follows the order of the file and says how the keys work together, with examples. The exhaustive tables, every key with its type, default, allowed values and description, are generated from the schemas and never diverge from them: [configuration reference](../reference/configuration.md), [lint configuration reference](../reference/lint.md), [theme reference](../reference/theme.md), [profile reference](../reference/profile.md), [lock file reference](../reference/lock.md). Every key not marked required is optional.

## `version`

Required. Schema version, currently `1`.

## `project`

`name` is displayed in the site. `locale` (`en` by default) is the interface language and the default locale of the sources; see [`sources[].locale`](#sources) for what a locale selects. `theme` names the theme file, relative to this configuration; without it, `theme.yaml` next to the configuration is used when it exists. `edit_url` is the pattern of the "edit in the forge" link, with `{source}`, `{path}` and `{commit}` placeholders; without it, a source whose `git` URL is an HTTPS URL of `github.com`, `gitlab.com` or a `gitlab.` host gets `<url>/edit/<ref>/<path>` or `<url>/-/edit/<ref>/<path>`, the `ref` being the source's or `main`, and a local source gets no link. `contribute_url` is the HTTPS address every call to action of the site leads to when no forge link can be built for it: "Propose a definition" on the page of a word nobody defined when no glossary source is on a known forge, "Edit this page" under a note without an edit link; without it and without a forge link, the call to action is not shown rather than shown inert. [Reference](../reference/configuration.md#project).

`legal` holds what only the organisation that publishes the site can declare, and nothing is ever pre-filled: `mentions_url`, `accessibility_url` and `privacy_url` are the HTTPS addresses of the legal notice, the accessibility statement and the personal data page, linked from the footer of every page under "Declared by the organisation"; without an address, a note filed at `legal/mentions.md`, `legal/accessibility.md` or `legal/privacy.md` in a source stands for the page and is linked instead; without either, the link is not shown. `accessibility_status`, one of `non-compliant`, `partially-compliant` or `compliant`, is the state the statement declares, worded after its link ("Accessibility — partially compliant"); without it the link reads "Accessibility" alone, since the tool cannot establish a state. `about` names a markdown file, relative to this configuration, whose sections are rendered after the generated content of the about page (`about/index.html`, linked from the footer): what the tool says of the site, the build instant, the repositories and their versions, stays generated; the file adds what the maintainer wants to say.

## `profile`

Path to the project profile, merged over the default profile key by key. See [writing notes](writing-notes.md#profile) for what a profile can add.

## `plugins`

List of plugins to load, in order. Each entry is a package name, a path to a module relative to this configuration file (`./plugins/theme/index.js`), or an object `{ name, options }`. The `@concordance-wiki/concordance` preset loads every official plugin by default; list them explicitly to restrict or reorder.

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

## `applications`

Containers of first level. Every entity is resolved to one, in increasing precedence: the source's `application`, a typing rule's `set: { application }` (the last matching rule wins), the note's frontmatter `application`. An entity without one yields `W-APP-MISSING`; an identifier that `applications:` does not declare is kept as written and yields `W-APP-UNKNOWN`. Applications and domains declared as notes are containers and are exempt from `W-APP-MISSING`.

```yaml
applications:
  - id: concordance-cli
    title: Concordance command line
    status: active   # active | legacy | target
```

## `domains`

Global business domains, orthogonal to sources. A domain claims files by the folders of the corpus, by globs, or both; a frontmatter `domain` overrides them. Whichever route claims a file, the entity records the full identifier path of its domain, `inference/recognition` below.

`folder: true` claims every file that has a directory named after the identifier on its path, in any source: with `- id: ingestion` and `folder: true`, `specs/ingestion/clone.md` and `glossary/ingestion/twin-resources.md` are filed together, while `notes/ingestion.md` is not, the file name never counting as a folder. `folder: <name>` claims the files under a folder of another name, one path segment (`^[A-Za-z0-9._-]+$`; `validate-config` rejects a slash). A subdomain declared by folder claims only the files whose segment lies under its parent's: with `recognition` a folder subdomain of the folder domain `ingestion`, `ingestion/recognition/scan.md` is filed under `ingestion/recognition` and `recognition/scan.md` under nothing. When the parent is declared by globs rather than by folder, the subdomain's segment may sit anywhere on a path the parent's globs match; a parent declared by neither, a frontmatter-only domain, constrains nothing.

`match` globs are evaluated on the path of every file relative to its source root, whatever the source; a glob such as `**/*keyword*` therefore files `glossary/keyword-page.md` and `specs/screens/keyword-page.md` together. A subdomain's globs are evaluated on their own, after its parent's.

Folders and globs combine on the same domain, and the precedence between domains does not depend on the route: the deepest domain that claims the file wins, and between domains of the same depth the last declared. A domain with neither `folder` nor `match` claims no file and is only ever named in frontmatter.

A frontmatter `domain` overrides folders and globs; it names a domain by its identifier (`recognition`, the first declared with it) or by its identifier path (`inference/recognition`). A value that names no declared domain is kept as written and yields `W-DOMAIN-UNKNOWN`. A note that no frontmatter, no folder and no glob files goes to the `unclassified` domain and yields `W-DOMAIN-UNCLASSIFIED`; applications and domains declared as notes are containers and are exempt. Every entity records how its domain was decided under `domain_origin`: `frontmatter`, `folder`, `glob`, `unclassified`, `lock` for a note the [lock file](#lock) files, `inferred` for one the proposal below filed.

A corpus nobody filed yet can ask the neighbourhood for a proposal: [`inference.domains`](#inferencedomains) names the terms with enough neighbours as pivots and reports every unclassified note within the radius as a candidate for the domain of its pivot — the pivot's own, else one named after it — without assigning anything. Promote what stands by declaring the domain here with the folders or globs that claim its notes, or by naming each note under `domains` in the lock file.

```yaml
domains:
  - id: ingestion
    title: Ingestion
    folder: true
    subdomains:
      - id: readers
        folder: reader
  - id: inference
    title: Inference
    match: ["**/inference/**", "**/links/**"]
    subdomains:
      - id: recognition
        folder: true
        match: ["**/dictionary/**"]
```

## `privacy`

`exclude` lists globs applied before any content is read. `pseudonymize` replaces speaker names and detected personal mentions by stable pseudonyms (`enabled`, `false` by default; `scope`, the types concerned, `[meeting]` by default; `dictionary`, the path of `pseudonyms.yaml`, real name to pseudonym, never published; `keep_roles`, the role instead of the pseudonym when known). `publish_transcripts` is `false` by default: transcripts are indexed only when explicitly requested. [Reference](../reference/configuration.md#privacy).

### Pseudonymisation

When `pseudonymize.enabled` is `true`, every transcript is pseudonymised before anything else reads it: the rendered page, the search index, the model and the file offered for download only ever see the pseudonymised form. Three things happen to a transcript.

- Every speaker named in the dictionary takes its pseudonym, or its role when `keep_roles` is `true` and the entry has one. A speaker the dictionary does not know becomes `Speaker-1`, `Speaker-2`… numbered by first appearance within that transcript, so that the numbering is stable as long as the transcript does not change; add the person to the dictionary for a pseudonym that survives an edit.
- Every occurrence of a real name of the dictionary inside the spoken text is replaced the same way, including the names of the numbered speakers. Names are matched on word boundaries, without regard to case or accents, longest name first: with both `Mary Ann` and `Mary Ann Smith` declared, "mary ann smith" becomes the pseudonym of the latter and "source" is never found inside "resource".
- A run of two or more capitalised words that no dictionary name covers, "Firstname Lastname" style, is reported as [`I-PII-DETECTED`](../checks/I-PII-DETECTED.md) for review and left as written. All-uppercase words are read as acronyms and never start a mention, and the heuristic knows nothing about sentences: a capitalised first word followed by a name is reported with the name.

`pseudonyms.yaml` is validated by [`pseudonyms.schema.json`](../../packages/core/schemas/pseudonyms.schema.json):

```yaml
version: 1
people:
  "Mary Ann Smith":
    pseudonym: Participant-1
    role: Project lead
  "Élodie Dupont":
    pseudonym: Participant-2
```

A dictionary that declares the same person twice, whatever the case and accents, or a name without a word, is refused with the path of the faulty entry. A missing or malformed dictionary is a [`W-PRIVACY-DICTIONARY`](../checks/W-PRIVACY-DICTIONARY.md) finding, never an exception: a warning while `enabled` is `false` (the file is checked all the same, so that it is right on the day it is switched on), an error that fails the build when it is `true`, with every transcript withheld from the output, because a site built without the dictionary would publish every name as written. The dictionary is read at build time only: it is never copied into the output, and the publication tests walk the output for its real names. Keep it out of any public repository. The page of a meeting says what applied: "Pseudonymised participants" under its title and, under its transcript, that the names are replaced by stable pseudonyms and the mapping never published.

The substitution goes further than the cues. The metadata of the transcript (its speakers, a title) is replaced before typing turns it into attributes. The download link of the page offers the transcript written back from the substituted cues by its reader, timecodes kept, comments dropped: the raw file is never copied into the output, and a transcript read by a plugin reader that cannot write it back is kept out of the site with [`W-PRIVACY-WITHHELD`](../checks/W-PRIVACY-WITHHELD.md). The notes and the other documents of the entities whose type is in `scope` (`meeting` by default) are replaced the same way, in their text, their properties and their entity (title, aliases, summary, attributes): a name in the minutes or on a slide of a meeting is the same leak as one in its transcript. A note outside the scope is published as written. Whatever the scope, the real names of the dictionary are never proposed as keyword pages.

`publish_transcripts` is what makes transcripts part of the published site and of its search index; a build without it reads them and keeps them out, positions, properties and file alike, pseudonymised or not, so that a transcript entity still finds its place next to its minutes without anything of it being published. `concordance validate-config` warns when it is `true` without `pseudonymize.enabled`, and reports an error when `pseudonymize.enabled` is `true` without a `dictionary`. Pseudonymisation is a technical mechanism, not an authorisation to publish: informing the participants, the legal basis and the retention period are governance decisions that the build cannot take. [Publishing transcripts](publishing-transcripts.md) sets out what to settle before the first build that publishes one.

## `sources`

One entry per repository or local folder ([reference](../reference/configuration.md#sources)). `name` is required and unique: it is the first segment of every identifier from the source, and never one of the folders the site reserves (`about`, `assets`, `fragments`, `index`, `keywords`, `search`, `spaces`, `todo`), which the validation refuses. A source is either a `git` URL, cloned on `ref` (`main` by default) with its whole history and without the blobs, so that every file carries the date of the last commit that touched it, or a local `path`, for development, relative to the configuration file and read as the platform reads paths (`../glossary` works everywhere, `..\glossary` on Windows); a local folder inside a git repository takes the same dates from that repository, and a file changed since its commit, or outside any repository, the date of the file system. `locale` (`en`, `fr`, `fr-CA`…) defaults to `project.locale` and selects the language pack of the source: text normalisation, default stopwords, plural rules, word segmentation and the collation of its indexes, plus the profile's type prefixes for that locale; the engine ships `en` and `fr`, a regional variant uses the pack of its language, other languages come from plugins, which register their pack, and a tag with no pack is a build error. `type` forces the type of every markdown file, `default_type` (`document`) applies when nothing else does, `application` is the default application of the source, which a rule's `set: { application }` and the frontmatter override. `title` names the space of the source wherever the site names it, the tree, the breadcrumb, the spaces pages, the facets of the search and the line under the title of a page; without it the name stands in, and the name stays the identifier in every address either way. `description` is one sentence saying what the source holds, shown as the content of its space on the spaces page and under the title of the page of the space; without it, the labels of the dominant types of the space stand in. `folders` titles and describes the folders of the source, keyed by their path relative to the source root (`screens`, `rules/links`): the `title` names the folder in the tree, the breadcrumbs, the cards of the space page and the heading of its list, the `description` is the sentence of its card on the space page; a folder not listed is named as written on the paths, and its card falls back on the description of the type its notes share. `glossary: true` marks the source as a glossary: its titles and aliases take priority in the recognition dictionary. `convert: false` skips the converters for the documents of the source, which stay downloadable entities without text, conversion being on by default; `previews: false` keeps its previews out of the artefact: the PDF of a document is not copied into `dist/`, the viewer is not offered, the download link and the extracted text remain. `rules` are the typing rules, evaluated in order, the last match winning.

A rule matches on `path` (glob), `suffix` (`.rule.md`), `ext` (`[".vtt"]`) or `frontmatter` (a key that must be present), and sets any attribute, most often `type`:

```yaml
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: concordance-cli
    rules:
      - match: { path: "screens/**" }
        set: { type: screen }
      - match: { path: "api/**" }
        set: { type: api }
      - match: { suffix: ".rule.md" }
        set: { type: rule }
      - match: { suffix: ".table.md" }
        set: { type: data_object }
  - name: meetings
    git: https://example.invalid/knowledge/meetings.git
    default_type: meeting
    convert: true
```

The full cascade, increasing precedence: `default_type`, `type`, `rules` in order, frontmatter. The origin is kept on the entity (`type_origin`) and shown in the site.

### Private repositories

Concordance never stores a token and never asks for one: `concordance.yaml` is versioned and often public. Credentials come from the git environment of the machine or pipeline, like any `git clone`, and the build disables every prompt, git's terminal prompt, the dialog of Git Credential Manager and the passphrase or host-key questions of ssh (batch mode, unless `GIT_SSH_COMMAND` names another command), so that a repository it cannot reach fails immediately with a `W-SOURCE-UNREACHABLE` finding instead of waiting for a password; a command that stalls is stopped after fifteen minutes, or the seconds `CONCORDANCE_GIT_TIMEOUT` gives ([operations](operations.md#the-commands-the-build-runs)).

GitHub Actions, repositories of the same organisation, with a token stored as a secret:

```yaml
      - run: git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
        env:
          TOKEN: ${{ secrets.KNOWLEDGE_READ_TOKEN }}
      - run: concordance build
```

GitLab CI, repositories of the same instance:

```yaml
  before_script:
    - git config --global url."https://gitlab-ci-token:${CI_JOB_TOKEN}@${CI_SERVER_HOST}/".insteadOf "https://${CI_SERVER_HOST}/"
```

SSH: declare the source with a `git@` URL and give the pipeline a read-only deploy key. On a workstation, the credential helper of the operating system applies.

## `staleness`

Days after which a source or a note is flagged `W-STALE`, with a default and per-source overrides:

```yaml
staleness:
  warn_after_days: { default: 60, glossary: 120 }
```

The home page reads the same thresholds: its freshness entry flags a source dormant when its newest change, by the git date of its notes, is older than its threshold at the instant of the build; without the key, 180 days.

## `inference`

The keys below decide what the dictionary holds, which links are produced and which expressions get a page; the [reference](../reference/configuration.md#inference) lists them with their types.

| Key | Default | Meaning |
|---|---|---|
| `glossary_sources` | sources with `glossary: true` | names of the sources whose entities take priority in the recognition dictionary: when the same form names several entities, theirs come first. When the key is present, even empty, it replaces the `glossary: true` marks |
| `stopwords` | language pack | extra stopword files, resolved against the folder of `concordance.yaml`, one word per line, `#` starts a comment; added on top of the defaults of the language pack. A title or alias that is a stopword, or a phrase made only of stopwords, never enters the dictionary, and the keyword discovery drops every n-gram starting or ending with one; stopwords are compared on the same normalised form as terms. The defaults of a pack hold what names nothing on its own in any corpus: articles, prepositions, pronouns, conjunctions, every form of the auxiliaries and light verbs (`être`, `avoir`, `faire`, `be`, `have`, `get`…), the adverbs and connectors of prose, quantifiers, numerals, ordinals and time words, the pieces of contractions and elisions (`s`, `t`, `aujourd`), and the few nouns that only count or place (`chose`, `fois`, `thing`, `way`). A word that could be a business term somewhere (`contrat`, `source`, `part`, `case`) or that ends a technical compound (`cold start`, `entry point`) is never a default: list the ones your corpus repeats without meaning here, typically the verbs of its own prose. A file that does not exist fails the build |
| `short_terms` | `[]` | allow-list of terms whose normalised form is shorter than three characters (`[FP, VL]`); every other such title or alias is left out of the dictionary. Compared without regard to case or accents |
| `type_prefixes` | language pack | words that announce a type (`screen`, `API`, `table`) and add 0.1 confidence; the defaults are those of the profile for the locale of the source |
| `cross_source_links` | `false` | resolve markdown links across sources, written with a `source:` prefix or as a relative path climbing into a sibling source; `W-LINK-CROSS-SOURCE` otherwise |
| `ngrams` | `{ min: 1, max: 4, min_occurrences: 3, min_documents: 2 }` | candidate expression discovery: the lengths of the n-grams read over the text units of every note and document, and the thresholds a candidate must reach (occurrences and distinct files) to be kept. An n-gram starting or ending with a stopword, made only of digits, shorter than three characters, already in the dictionary or listed in the lock's `rejected_terms` is never a candidate |
| `keyword_pages` | `{ min_occurrences: 3, min_files: 2, min_confidence: 0.5 }` | publication threshold of a keyword page: a discovered expression gets a page under `keywords/<slug>` only from `min_occurrences` occurrences in `min_files` distinct files, with a [confidence](#word-confidence) of at least `min_confidence` (between 0 and 1). Below the counts it stays in the output for the search index but has no page; at the counts but under the confidence it is suspected noise: no page, no mark in the text, listed on the to-do page with its reason, still searchable. Distinct from `ngrams`: `ngrams.min_occurrences` and `ngrams.min_documents` decide which expressions the discovery keeps at all (and can report as `W-TERM-UNDEFINED`), `keyword_pages` decides which of them become pages; lowering `keyword_pages` below `ngrams` has no effect. The build summary reports `keyword pages`, `expressions under the threshold` and `expressions set aside by confidence` |
| `neighbours` | `{ k: 50 }` | `k` is the number of co-occurrence neighbours kept per node, ranked by the number of shared paragraphs then by identifier; it bounds the memory of the accumulation and the size of the `neighbours` block of `model.json` (see the [architecture guide](architecture.md#bounded-neighbourhood)) |
| `candidate_score` | 4.0 | score from which a candidate yields [`W-TERM-UNDEFINED`](../checks/W-TERM-UNDEFINED.md); the score is the C-value of the expression multiplied by its IDF, both described on the check page |
| `duplicates` | see below | how the twin resources of one document (a deck, its notes, its transcript) are reconciled |
| `domains` | absent | domains proposed from the neighbourhood graph, see below; nothing is proposed while the key is absent |

### Word confidence

Counts do not tell a term of the corpus from a word of its own prose: an adverb and a business object can both have eighty occurrences. The shape of the distribution does. Every candidate expression carries a **confidence** in [0, 1], the product of five independent signals each in [0, 1], rounded to four decimals, computed in the same pass as the score, from the corpus alone, without learning or network; the same corpus gives the same values from one build to the next. With `N` the files of the corpus of the locale, `df` the distinct files holding the expression and `occ` its occurrences:

| Signal | Measure | Factor |
|---|---|---|
| Spread | `spread = df / N` | 1 up to `max_spread` (0.5), then `1 − (spread − max_spread) / (1 − max_spread)`: linear down to 0 for a word in every file. Read only in a corpus of at least 10 files; in a handful, every word is everywhere |
| Burst | `burst = occ / df` | 1 from 1.5 occurrences per file, else `0.5 + (burst − 1)`: one half for a word met once in every file where it appears. Read only from 5 files; a term recurs where it is treated, a function word appears once everywhere |
| Position | `prominence = min(1, appearances in a heading, a written link or a frontmatter string / occ)` | `0.8 + 0.2 × prominence`: an author puts terms forward, never an adverb |
| Neighbourhood | the expression is, or is a component of, a frequent n-gram that also holds a defined term (`build summary` next to the defined `build`) | 1 with the bonus, 0.9 without |
| Morphology | a word of the expression ends with an inflected-form suffix of the language pack (`fr`: -ment, -ait, -aient, -ez, -era, -erait; `en`: -ly, -ing, -ed; the optional `suffixes.txt` of a pack, one suffix per line, `#` comments; a pack without it penalises no form) | 0.8 for an inflected form: soft, never eliminatory, `document` and `payment` are terms |

A plain term of the subject, concentrated and recurring, scores 0.72; put forward in headings or accompanied by a defined term it climbs towards 1; a word met once in every file falls to 0.36 and a word in every file of the corpus to 0. The headings, written links and frontmatter count as prominent texts only: they are not usage, so they never add an occurrence. `model.json` carries the confidence, the five measures (`signals`) and the signals that lowered it (`penalties`) on every term candidate, and the confidence among the attributes of every keyword page.

### `inference.duplicates`

Two resources are scored by adding their signals, capped at 1: an explicit frontmatter `source` declaration (1.0), the same base name in the same folder (0.7) or elsewhere (0.5), base names at Jaro-Winkler 0.9 or more (those weights times 0.8), the property title of one equal to the level-one heading of the other (0.6), similar extracted text (0.7 from an estimated Jaccard index of 0.8, 0.4 from 0.6), the same commit (0.3) and the folder proximity (up to 0.2). Above `merge_above` the resources become one entity with several representations; from `candidate_above` they stay separate and a [`W-DUP-CANDIDATE`](../checks/W-DUP-CANDIDATE.md) finding names the score and every signal. The commit and the folder only reinforce a pair found by a declaration, a base name, a title or its text. See the [architecture guide](architecture.md#twin-resources).

The seven keys are in the [reference](../reference/configuration.md#inferenceduplicates): `mode` (`auto`; `estimate` never recomputes the exact Jaccard index and reports the MinHash estimate, `exact` recomputes it on every pair the LSH banding brings together, `auto` on the pairs estimated at `exact_above` or more), `exact_above` (0.5), `size_ratio_min` (0.5, the word-count ratio under which the content signal is capped at 0.4 and the finding says the pair looks like an inclusion), `shingle_size` (5 words), `minhash_functions` (128, four per LSH band), `merge_above` (0.9, strictly above which resources merge) and `candidate_above` (0.5, from which a finding is produced).

Build time against precision: the estimate alone visits every candidate pair once through its 128-value signature, the exact index re-reads the two full shingle sets of a pair, and `auto` spends that only on the pairs that are already close. Lowering `exact_above` or choosing `exact` makes the index in the findings exact on more pairs at the cost of build time, `estimate` makes the build fastest with an index accurate to about one tenth. The build summary reports the pairs brought together by the banding, the pairs scored, the exact verifications and the time spent.

### `inference.domains`

Domains proposed from the neighbourhood, for a corpus nobody filed. `min_neighbours` (an integer of at least 1) is the degree from which a term with a note of its own becomes a pivot, its degree being the number of distinct neighbours in the undirected graph of the typed links and the co-occurrence neighbours; a stopword or a `rejected_terms` entry of the lock file never pivots. `max_neighbours` (optional) is the degree above which a term is a hub of the corpus rather than a domain — the word every note uses, `build` or `note` in a wiki about a build tool — and never pivots: without it the hubs win every tie and every proposal names them. `radius` (1 to 3) is the distance, in edges, within which a note belongs to a pivot: every note no frontmatter, folder or glob files that lies within it is attached to the closest pivot, at equal distance to the pivot of highest degree, then to the first in code-unit order of its identifier, and the domain proposed is the pivot's own when something files the pivot (a folder, a glob, its frontmatter, the lock) — an unclassified note joins the domain of the terms it is close to — else a domain named after the last segment of the pivot's identifier. The same corpus gives the same proposal from one build to the next.

The proposal reads as one [`I-DOMAIN-SUGGESTED`](../checks/I-DOMAIN-SUGGESTED.md) per reached note (`specs/roles/maintainer lies within 1 of glossary/check (degree 14): a candidate for its domain "quality"`, or `a candidate for a domain named "check" after it` when nothing files the check term) and as the `suggested domains` section of the build summary and of `build.log.json`, each pivot that reaches a note with its degree and the notes. Nothing is assigned by default: a growing corpus moves its pivots, and a note would swing from one domain to another between two builds. Promote a proposal by declaring the domain under [`domains`](#domains) with the folders or globs that claim its notes, or by naming the note under `domains` in the [lock file](#lock), which files it with the origin `lock`; a declaration always wins over the lock. `assign: true` lets the build file every reached note itself under the domain its pivot proposes, with the origin `inferred`, and never touches a note with a declared domain; the files the build grouped into a filed note, a transcript or a deck, are filed with it. On the page of such a note the domain reads in italics, and hovering it says that the build proposed it.

```yaml
inference:
  domains: { min_neighbours: 10, max_neighbours: 60, radius: 2 }
```


## `conversion`

`timeout_s` (120) bounds each document, `max_size_mb` (50) leaves larger files unconverted, `cache` (`.concordance-cache`) names the cache folder, outside `dist/`, and `parallelism` (the number of cores) the concurrent conversions ([reference](../reference/configuration.md#conversion)).

The converted files are keyed by the SHA-256 of their source under `<cache>/convert/`, the PDF as `<sha256>.pdf` and the text of its pages as `<sha256>.text.json`, so that an unchanged document is never reconverted nor re-read, even when it moves. The cache never enters `dist/`: keep it in the pipeline cache between builds, and delete it to force a full reconversion. A document above `max_size_mb` or past `timeout_s` yields a [`W-CONV-FAILED`](../checks/W-CONV-FAILED.md) finding and stays downloadable; `parallelism` changes the build time, never the output.

## `build`

`output` (`./dist`) is the site folder; `fail_on.errors` (`true`) fails the build when any error finding exists and `fail_on.unconverted_max` (10) beyond that many unconverted documents; `mentions_inline` (20) is the number of mentions of an entity served in its page, the rest coming from the `fragments/<id>.mentions.json` of the entity; `extracted_text_max_chars` (20000) is how many characters of the body of an entity enter the search index: the plain text of its note and the text extracted from its documents, which is also cut at this many characters in all across the pages of a document, in its fragment and on its page; the rest is not searchable, the download gives it ([reference](../reference/configuration.md#build)).

`fail_on` is the only thing that makes the build fail on content: an anomaly is always recorded as a finding and the build goes on. With the defaults, one error finding is enough to exit with code 1, and so is the eleventh unconverted document; the log and the summary are written either way. A project that wants a site whatever the state of its notes declares:

```yaml
build:
  fail_on: { errors: false, unconverted_max: 100 }
```

`--output` on the command line overrides `output`; the folder receives `build.log.json` with the summary and every finding, sorted.

`mentions_inline` bounds what the mentions panel of an entity page carries in the served HTML: that many mentions, readable without JavaScript, grouped by related page, the first passage of each of the six pages listed first so that a small value still serves six entries. The others stay in the JSON fragment of the entity, one file per entity, which the panel loads on demand; under two hundred mentions in all they also travel in the page, inside a script block, so that no request is needed. `0` serves no mention inline and leaves everything to the fragment; a large value trades page weight against requests. The [theming guide](theming.md#mentions-panel) describes the three regimes.

## `site`

`neighbourhood.size` (6) is the number of nodes of the neighbourhood mini-map of a page, an integer from 1 to 12; a larger value is a configuration error, the map being legible only up to twelve labelled nodes. Which nodes are kept follows the `display.neighbours_order` of the page's type in the profile (see the [architecture guide](architecture.md#displayed-neighbourhood)).

`url` is the HTTPS address the site is published at, its path included when the host serves it under one (`https://example.org/handbook/`). The page written for a missing address, `404.html`, is served by GitHub Pages and GitLab Pages at any address under the site, so its links cannot be relative: it links back through this address, and assumes the root of the host without it.

`publish_every_days` is the number of days between two publications, as the pipeline is scheduled: `1` for a nightly build. Past three times that many days, every page shows a notice giving the age of the site, so that a reader knows a recent change of the repositories may be missing; the notice closes and stays closed until a later publication grows old in its turn. A static site can only tell its own age, never that a publication failed: without the key no page counts the days.

```yaml
site:
  url: https://example.org/handbook/
  publish_every_days: 1
  neighbourhood: { size: 8 }
```

## `checks`

Enable, disable or re-severitise a check:

```yaml
checks:
  W-TERM-UNUSED: { severity: info }
  W-STALE: { enabled: false }
```

Each key is a check identifier from the [check catalogue](../checks/README.md). `enabled: false` removes the check entirely: it is not run, and the findings a pipeline step reports under that identifier are dropped from the build log and the model. `enabled: true`, the default, keeps it. `severity` replaces the default severity on every finding of that check, including a finding the check itself reported at another severity (a plugin whose optional dependency is missing reports `W-PLUGIN-DISABLED` as `info`; `severity: warning` makes every such finding a warning). Both keys combine: a disabled check produces nothing whatever its severity. A key that names no registered check, built-in or contributed by a loaded plugin, is a configuration mistake: the build and the linter stop with an execution error (exit code 2) that names the identifier, rather than silently ignoring the override.

The same block, in a `concordance-lint.yaml` at the root of a knowledge repository, overrides severities locally for the linter.

## `concordance-lint.yaml`

Read by `concordance lint` at the root of the linted repository, and by the build for its `exclude` key when it reads the repository as a source; validated against [`lint.schema.json`](../../packages/core/schemas/lint.schema.json), every key listed in the [lint configuration reference](../reference/lint.md). The file carries three blocks: `exclude`, the files of the repository that are not notes; `checks`, with the same shape and the same rules as above; and `global`, which says where the [global scope](command-line.md#global-scope) finds the published model:

```yaml
exclude:
  - "vendor/**"
  - "site/**"
checks:
  E-LINK-BROKEN: { severity: warning }
  W-STALE: { enabled: false }
global:
  model: https://concordance-wiki.github.io/demo-wiki/model.json
  cache_dir: .concordance-cache/lint
  max_age_hours: 24
```

`exclude` lists globs relative to the root of the repository, with the syntax and the matcher of [`privacy.exclude`](#privacy): a vendored folder, a generated site, a cloned tool, whose files would otherwise be read as notes. An excluded file is never read, never counted and never reported, by the linter and by the build alike, so that a repository lints clean exactly when the build reports nothing on it; `privacy.exclude` of the wiki configuration applies on top, and a build that reads a repository whose `concordance-lint.yaml` is faulty skips that source with a [`W-SOURCE-UNREACHABLE`](../checks/W-SOURCE-UNREACHABLE.md) finding, as the linter refuses to run on it. The files git ignores are left out the same way, without being listed: every `.gitignore` of the repository is read with the rules git applies (comments, negation, folder patterns, `**`, anchored patterns, escapes, a nested file overriding the ones above it; not the global exclude file of the user nor `.git/info/exclude`); [`--no-gitignore`](command-line.md#lint) checks them all the same.

A `checks` entry replaces the entry of the same check given under `checks` in the `concordance.yaml` passed with `--config`; the other entries of the configuration still apply. An empty file overrides nothing.

| Key | Default | Effect |
|---|---|---|
| `exclude` | none | globs of the files never read, counted or reported, relative to the repository; honoured by the build too |
| `global.model` | none | the published `model.json` of the wiki: a URL (`https://…/model.json`) fetched and cached, or a path relative to the repository (`../wiki/dist/model.json`) read as it is; without it `--scope global` degrades to the local checks |
| `global.cache_dir` | `.concordance-cache/lint` | where the fetched model and its `model.meta.json` (fetch date, source URL, `ETag` and `Last-Modified` when the server gave them) live, relative to the repository |
| `global.max_age_hours` | `24` | how long the cached model is reused without any request; `0` revalidates on every run, with the validators the server gave |
| `global.profile` | none | a project profile, relative to the repository, merged over the default one for the relation matrix and the types of the global checks |

Any other top-level key, an empty glob under `exclude`, a key that is not a check identifier, an unknown check, a value outside `severity` and `enabled`, an unknown `global` key, an empty `model` or a negative `max_age_hours` stops the linter with an execution error (exit code 2) naming the file and the key.

## `lock`

Path to `concordance.lock.yaml`, relative to the configuration, the record of human decisions ([lock file reference](../reference/lock.md)). The build reads the file, validates it against [`lock.schema.json`](../../packages/core/schemas/lock.schema.json) and applies three of its blocks:

- `rejected_terms`, the expressions the keyword discovery must not propose: no candidate, no [`W-TERM-UNDEFINED`](../checks/W-TERM-UNDEFINED.md), no keyword page, no mark in the text, no line on the to-do page. An expression is compared on its normalised form, the one the language pack gives the text, so `Merge Request` rejects `merge request` and `merge requests` alike.
- `duplicates`: `merged`, pairs of resource identifiers that merge into one entity whatever their score, the criterion recorded as `lock file` in `grouped_by`; `separated`, pairs that never merge and produce no [`W-DUP-CANDIDATE`](../checks/W-DUP-CANDIDATE.md).
- `domains`, the domain of a note by its identifier, a proposal of [`I-DOMAIN-SUGGESTED`](../checks/I-DOMAIN-SUGGESTED.md) promoted: the note is filed there with the origin `lock` unless its frontmatter, a folder or a glob files it already, and the proposal leaves it aside.

`links`, the promoted and rejected links, is recorded, not read: the build of this version produces no `lock_promoted` link, and `validate-config` says so with a warning on the `lock` key. A missing or invalid lock file is a configuration error: the build stops with exit code 1, naming the file and the faulty key, so that a decision is never silently dropped; a configuration without `lock` applies none. The end-of-build summary and `build.log.json` count the decisions applied under `lock` (`rejected_terms`, `merged`, `separated`, `domains`: the entries of each block).

```yaml
version: 1
rejected_terms:
  - Merge Request
duplicates:
  separated:
    - [glossary/canonical-model, specs/api/canonical-model]
domains:
  specs/roles/maintainer: quality
```

Each entry answers a finding of an earlier build: the remediation of `W-TERM-UNDEFINED`, `W-DUP-CANDIDATE` and `I-DOMAIN-SUGGESTED` names the block to write it in. The file lives next to the configuration, versioned and reviewed like any change; nothing is ever written into a knowledge repository.

## `theme.yaml`

Every key is in the [theme reference](../reference/theme.md); the theme shipped in [`brand/theme.yaml`](../../brand/theme.yaml) is an example, and `fixtures/plugins/theme-white-label/theme/theme.yaml` a complete white-label one. Paths are relative to the file. A faulty key is reported by its path (`light.accent`, `footer.credit`), a named file that does not exist by its key; the [theming guide](theming.md#white-label) says what each key changes in the site. In short: `name` is the name of the site, in the header and every page title; `logo` (an SVG is inlined, any other image copied under `assets/`) and `favicon` are paths; `font.display`, `font.ui` and `font.mono` name the families of headings, interface and code, whose files the project ships through `assets` and `@font-face` rules in `stylesheet`, never fetched from another host; `radius` is the corner radius in pixels; `light` and `dark` each give `bg`, `surface`, `border`, `ink`, `muted` and `accent` as `#RRGGBB` colours, and may add `label`, `soft` and `highlight` (derived from `muted`, `bg` and `border` otherwise), text reaching 4.5:1 over `bg`, `surface` and `soft` and headings 3:1, the accent never carrying information on its own; `default_mode` is the palette the site starts with, the reader's own choice winning; `footer.text`, `footer.links` and `footer.credit` (`false`: "Built with Concordance" as a link to the repository, the only mention of the tool) fill the footer; `stylesheet` is loaded after the tool's own, in the `project` cascade layer; `assets` is a folder copied as-is; `labels` holds the message overrides below.

### `labels`

Every label of the generated site comes from a message catalogue per language, shipped by [`@concordance-wiki/i18n`](../../packages/i18n/README.md) in ICU MessageFormat: `en` is the source, `fr` a complete translation, and a project whose locale has no catalogue gets the source labels. The `labels` block overrides any message, by language of a shipped catalogue then by message identifier; the identifiers are the keys of the source files under [`messages/en/`](../../packages/i18n/messages/en/), one per area of the site (`home.json`, `entity.json`, `search.json`...), whose `description` says where each label appears.

```yaml
labels:
  en:
    site.home: Start
    entity.mentionsCount: "{count, plural, one {# citation} other {# citations}}"
  fr:
    site.home: Début
```

An override is written in the same syntax as the message it replaces and must use exactly the variables of the source message. An unknown identifier, a syntax error or a missing or extra variable is a configuration error that names the faulty key (`labels.fr.site.home` style), reported with the other theme errors. The block of the language the build uses is the only one applied: a project in `fr-CA` takes `labels.fr`.

## Continuous integration

The pipelines that build and publish the wiki on GitHub Pages and GitLab Pages, with the published package or with the container image, and the ones that lint a knowledge repository in its merge requests with the SARIF log or the JUnit report the forge annotates the diff with, are gathered in [Pipelines](pipelines.md), complete and copyable. Keep `.concordance-cache` in the pipeline cache so that clones are refreshed rather than redone; the GitHub action `concordance-wiki/lint-action` and the GitLab CI/CD component `concordance-wiki/lint/lint` wrap the lint job in one line each, with the version of the linter pinned ([Distributing the linter](lint-distribution.md)).
