# Configuration reference

Every key of `concordance.yaml`, generated from [`config.schema.json`](../../packages/core/schemas/config.schema.json) by `scripts/config-reference.mjs`: edit the schema, then run `pnpm reference:update`. The [guide](../guides/configuration.md) explains how the keys work together.

Schema of concordance.yaml.

A key marked (required) must be present; every other key is optional and takes the default shown, or none. Paths use `[]` for the items of a list and `*` for the keys of a map.

## Top-level keys

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `version` (required) | constant | — | `1` | Version of this schema; always 1. |
| `project` (required) | object | — | — | The project: its name, its interface language, its theme file, its edit link, the pages the organisation declares and the file that extends the about page. See [`project`](#project). |
| `profile` | string | — | — | Path of the project profile, relative to this configuration, merged key by key over the default profile. |
| `plugins` | (string \| object)[] | — | each: non-empty | Plugins to load, in order: a package name, or an object with the name and its options. The concordance preset loads every official plugin; list them here to restrict or reorder them. See [`plugins[]`](#plugins). |
| `applications` | object[] | — | — | First-level containers every entity is resolved to, through its source, a typing rule or its frontmatter. An identifier not declared here yields W-APP-UNKNOWN; an entity without one yields W-APP-MISSING. See [`applications[]`](#applications). |
| `domains` | object[] | — | — | Global business domains, orthogonal to the sources, resolved by the folders and the globs on the path of every file relative to its source root. A frontmatter domain overrides them; a note no domain claims goes to unclassified. See [`domains[]`](#domains). |
| `privacy` | object | — | — | What is never read, whether transcripts are pseudonymised and whether they are published. See [`privacy`](#privacy). |
| `sources` (required) | object[] | — | at least 1 item | The repositories and local folders the wiki is built from, one entry each. Names are unique and prefix every identifier. See [`sources[]`](#sources). |
| `staleness` | object | — | — | Days without a change after which a source or a note is flagged W-STALE and the home page marks the source dormant. See [`staleness`](#staleness). |
| `inference` | object | — | — | Thresholds and options of the recognition dictionary, the link producers, the keyword discovery and the twin-resource reconciliation. See [`inference`](#inference). |
| `conversion` | object | — | — | Office document conversion: its limits, its cache and its parallelism. See [`conversion`](#conversion). |
| `build` | object | — | — | Where the build writes, what its pages embed and when it fails. See [`build`](#build). |
| `site` | object | — | — | Options of the generated pages. See [`site`](#site). |
| `checks` | map of object | — | keys: pattern `^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$` | Overrides of the check registry, by check identifier: disable a check or change the severity of its findings. An identifier no loaded check registers is an execution error. See [`checks.*`](#checks). |
| `lock` | string | — | — | Path of concordance.lock.yaml, the record of human decisions, relative to this configuration; the build applies its rejected_terms, duplicates and domains and stops on a missing or invalid file; its links are recorded, not read. |

## `project`

The project: its name, its interface language, its theme file, its edit link, the pages the organisation declares and the file that extends the about page.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `name` (required) | string | — | non-empty | Name of the project, the title of the site. |
| `locale` | string | `"en"` | pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$` | Interface language and default locale of the sources, as a BCP 47 tag; the engine ships en and fr, plugins may add others. |
| `theme` | string | — | — | Path of the theme file, relative to this configuration. Without it, theme.yaml next to the configuration is used when it exists, else a neutral default theme. |
| `edit_url` | string | — | — | Pattern of the edit link in the footer of every page, with {source}, {path} and {commit} placeholders. Without it, a source hosted on github.com or on a GitLab instance gets the edit URL of its forge, and a local source gets none. |
| `contribute_url` | string | — | pattern `^https://[^\s]+$` | HTTPS address every call to action of the site leads to when no forge link can be built for it: proposing a definition, editing a page. Without it and without a forge link, the call to action is not shown. |
| `legal` | object | — | — | What only the organisation that publishes the site can declare: its legal notice, its accessibility statement and its personal data page. None has a default; each link appears in the footer of every page once its address is given or a note stands at legal/<page>.md in a source. See [`project.legal`](#projectlegal). |
| `about` | string | — | non-empty | Path of a markdown file, relative to this configuration, rendered after the generated content of the about page: what the maintainer wants to add to what the tool says of the site. |

### `project.legal`

What only the organisation that publishes the site can declare: its legal notice, its accessibility statement and its personal data page. None has a default; each link appears in the footer of every page once its address is given or a note stands at legal/<page>.md in a source.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `mentions_url` | string | — | pattern `^https://[^\s]+$` | HTTPS address of the legal notice. Without it, a note at legal/mentions.md in a source stands for the page; without either, the footer shows no legal notice. |
| `accessibility_url` | string | — | pattern `^https://[^\s]+$` | HTTPS address of the accessibility statement. Without it, a note at legal/accessibility.md in a source stands for the page; without either, the footer shows no accessibility link. |
| `accessibility_status` | enum | — | `non-compliant`, `partially-compliant`, `compliant` | The compliance the accessibility statement declares, worded after its link in the footer; never derived, never assumed: without it the link reads without a state. |
| `privacy_url` | string | — | pattern `^https://[^\s]+$` | HTTPS address of the personal data page. Without it, a note at legal/privacy.md in a source stands for the page; without either, the footer shows no personal data link. |

## `plugins[]`

Plugins to load, in order: a package name, or an object with the name and its options. The concordance preset loads every official plugin; list them here to restrict or reorder them.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `name` (required) | string | — | non-empty | Package name or module path of the plugin. |
| `options` | object | — | — | Options passed to the plugin, in the shape its manifest documents. |

## `applications[]`

First-level containers every entity is resolved to, through its source, a typing rule or its frontmatter. An identifier not declared here yields W-APP-UNKNOWN; an entity without one yields W-APP-MISSING.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `id` (required) | string | — | pattern `^[a-z][a-z0-9-]*$` | Identifier of the application: lowercase letters, digits and hyphens. |
| `title` | string | — | — | Display title of the application; the identifier when absent. |
| `status` | enum | — | `active`, `legacy`, `target` | Lifecycle status of the application: active (in use), legacy (being retired) or target (not built yet). |

## `domains[]`

Global business domains, orthogonal to the sources, resolved by the folders and the globs on the path of every file relative to its source root. A frontmatter domain overrides them; a note no domain claims goes to unclassified.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `id` (required) | string | — | pattern `^[a-z][a-z0-9-]*$` | Identifier of the domain: lowercase letters, digits and hyphens. A subdomain is addressed by its identifier or by its identifier path (inference/recognition). |
| `title` | string | — | — | Display title of the domain; the identifier when absent. |
| `match` | string[] | — | each: non-empty | Globs evaluated on the path of every file relative to its source root, whatever the source. The deepest matching domain wins, then the last declared. |
| `folder` | boolean \| string | — | pattern `^[A-Za-z0-9._-]+$` | Claims every file with a folder of that name on its path, in any source: true for a folder named after the identifier, a string for another folder name (one path segment, no slash). A subdomain's folder must lie under its parent's. Combines with match. |
| `subdomains` | object[] | — | — | Domains nested under this one, with the same shape; their globs are evaluated after their parent's, their folder is looked for under their parent's folder. Same shape as [`domains[]`](#domains). |

## `privacy`

What is never read, whether transcripts are pseudonymised and whether they are published.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `exclude` | string[] | — | each: non-empty | Globs of the files excluded before any content is read, relative to the root of every source. |
| `publish_transcripts` | boolean | `false` | — | Whether transcripts are part of the published site and of its search index; they are kept out unless this is true. |
| `pseudonymize` | object | — | — | Replacement of the speaker names and of the detected personal mentions by stable pseudonyms, before anything else reads a transcript. See [`privacy.pseudonymize`](#privacypseudonymize). |

### `privacy.pseudonymize`

Replacement of the speaker names and of the detected personal mentions by stable pseudonyms, before anything else reads a transcript.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `enabled` | boolean | `false` | — | Whether pseudonymisation runs; it requires a dictionary. |
| `scope` | string[] | `["meeting"]` | each: pattern `^[a-z][a-z0-9_]*$` | Types whose notes are pseudonymised. |
| `dictionary` | string | — | — | Path of pseudonyms.yaml, the dictionary of real names to pseudonyms, relative to this configuration; read at build time, never published. |
| `keep_roles` | boolean | `false` | — | Whether a speaker whose dictionary entry carries a role is shown by that role rather than by the pseudonym. |

## `sources[]`

The repositories and local folders the wiki is built from, one entry each. Names are unique and prefix every identifier.

Exactly one of: `git` is set; `path` is set; `kind` is `"tracker"`.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `name` (required) | string | — | pattern `^[a-z0-9][a-z0-9-]*$` | Name of the source, unique in the configuration: the first segment of every identifier it yields. Lowercase letters, digits and hyphens. |
| `git` | string | — | non-empty | URL of the git repository, cloned on ref with its history and without the blobs, with the credentials of the git environment; exclusive with path. |
| `ref` | string | `"main"` | — | Branch, tag or commit of the git repository to read. |
| `path` | string | — | non-empty | Local folder, relative to this configuration, read in place; exclusive with git. |
| `kind` | enum | — | `git`, `path`, `tracker` | Kind of the source, deduced from git or path; tracker declares an issue tracker source, accepted but not read in this version. |
| `locale` | string | — | pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$` | Locale of the source, as a BCP 47 tag; selects its language pack (normalisation, stopwords, plural rules, collation) and the type prefixes of the profile for that language. Defaults to project.locale; the engine ships en and fr, plugins may add others. |
| `type` | string | — | pattern `^[a-z][a-z0-9_]*$` | Type given to every markdown file of the source, above default_type and below the rules and the frontmatter. |
| `default_type` | string | `"document"` | pattern `^[a-z][a-z0-9_]*$` | Type of a note when nothing else applies. |
| `application` | string | — | pattern `^[a-z][a-z0-9-]*$` | Application every entity of the source belongs to, unless a rule or the frontmatter says otherwise. |
| `title` | string | — | non-empty | Title of the space of the source, shown wherever the site names it: the tree, the breadcrumb, the spaces and the facets; the name stands in without it and stays the identifier in every address. |
| `description` | string | — | non-empty | One sentence saying what the source holds, shown as the content of its space on the spaces page; without it, the dominant types of the space stand in. |
| `folders` | map of object | — | keys: pattern `^[^/\s][^\s]*[^/\s]$\|^[^/\s]$` | The folders of the source the site titles and describes, keyed by their path relative to the source root, such as rules/links; a folder not listed is named as written. See [`sources[].folders.*`](#sourcesfolders). |
| `glossary` | boolean | `false` | — | Whether the source is a glossary: its titles and aliases take priority in the recognition dictionary. |
| `convert` | boolean | `false` | — | Whether the office documents of the source are converted, for preview and text extraction. |
| `previews` | boolean | `true` | — | Whether the previews of the converted documents of the source are published with the site; false keeps them out of the artefact. |
| `defaults` | map of string \| number \| boolean | — | — | Default attribute values for the entities of the source; accepted but not read in this version. |
| `rules` | object[] | — | — | Typing rules evaluated in order on every file of the source; the last matching rule wins, over type and under the frontmatter. See [`sources[].rules[]`](#sourcesrules). |
| `provider` | string | — | — | Provider of a tracker source; accepted but not read in this version. |
| `project` | string | — | — | Project identifier in the tracker of a tracker source; accepted but not read in this version. |

### `sources[].folders.*`

The folders of the source the site titles and describes, keyed by their path relative to the source root, such as rules/links; a folder not listed is named as written.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `title` | string | — | non-empty | Title of the folder wherever the site names it: the tree, the breadcrumb, the categories of the space and the heading of its list. |
| `description` | string | — | non-empty | One sentence on what the folder holds, shown on its card on the page of the space. |

### `sources[].rules[]`

Typing rules evaluated in order on every file of the source; the last matching rule wins, over type and under the frontmatter.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `match` (required) | object | — | at least 1 key | What a file must satisfy for the rule to apply; every condition given must hold. See [`sources[].rules[].match`](#sourcesrulesmatch). |
| `set` (required) | map of string \| number \| boolean | — | at least 1 key | Attributes given to the matching files, most often type; application and any entity attribute are accepted, the frontmatter still wins. |

### `sources[].rules[].match`

What a file must satisfy for the rule to apply; every condition given must hold.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `path` | string | — | — | Glob matched against the path of the file relative to the source root. |
| `suffix` | string | — | — | Suffix of the file name (.rule.md), stripped from the identifier of the note. |
| `ext` | string[] | — | each: pattern `^\.` | Extensions, each starting with a dot, one of which the file must carry. |
| `frontmatter` | string | — | — | Name of a frontmatter key the note must carry. |

## `staleness`

Days without a change after which a source or a note is flagged W-STALE and the home page marks the source dormant.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `warn_after_days` | map of integer | `{"default":180}` | values: at least 1 | Thresholds in days: the default key applies to every source, a key named after a source overrides it for that source. |

## `inference`

Thresholds and options of the recognition dictionary, the link producers, the keyword discovery and the twin-resource reconciliation.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `glossary_sources` | string[] | — | — | Names of the sources whose entities take priority in the recognition dictionary when one form names several entities. When present, even empty, it replaces the glossary marks of the sources. |
| `stopwords` | string[] | — | — | Extra stopword files, relative to this configuration, one word per line and # for a comment, added to the defaults of the language pack; a title or alias that is a stopword never enters the dictionary. A missing file fails the build. |
| `short_terms` | string[] | `[]` | — | Terms whose normalised form is shorter than three characters and that enter the dictionary anyway (FP, VL); every other such title or alias is left out. Compared without regard to case or accents. |
| `type_prefixes` | map of map of string[] | — | — | Words that announce a type in prose and raise the confidence of the mention that follows, by locale then by type; each list replaces the profile's for that type. |
| `cross_source_links` | boolean | `false` | — | Whether markdown links across sources, written with a source: prefix or as a relative path climbing into a sibling source, are resolved; otherwise they yield W-LINK-CROSS-SOURCE. |
| `ngrams` | object | — | — | Discovery of the recurring expressions without a note: the lengths of the n-grams read over the text of every note, and the thresholds a candidate must reach to be kept at all. See [`inference.ngrams`](#inferencengrams). |
| `keyword_pages` | object | — | — | Publication threshold of a keyword page: a discovered expression gets a page under keywords/ only from min_occurrences occurrences in min_files distinct files, with a confidence of at least min_confidence; below it, it stays in the search index without a page. See [`inference.keyword_pages`](#inferencekeyword_pages). |
| `neighbours` | object | — | — | Bound of the co-occurrence neighbourhood accumulated per node. See [`inference.neighbours`](#inferenceneighbours). |
| `candidate_score` | number | `4` | at least 0 | Score from which a candidate expression yields W-TERM-UNDEFINED: the C-value of the expression multiplied by its IDF. |
| `duplicates` | object | — | — | How the twin resources of one document (a deck, its notes, its transcript) are reconciled: the signals of a pair are added, capped at 1, and the total decides between a merge and a W-DUP-CANDIDATE finding. See [`inference.duplicates`](#inferenceduplicates). |
| `domains` | object | — | — | Domains proposed from the neighbourhood graph: every term with a note whose degree reaches min_neighbours is a pivot, and every unclassified note within radius edges of one is a candidate for a domain named after it, reported as I-DOMAIN-SUGGESTED and listed in the build log. Absent, nothing is proposed. See [`inference.domains`](#inferencedomains). |

### `inference.ngrams`

Discovery of the recurring expressions without a note: the lengths of the n-grams read over the text of every note, and the thresholds a candidate must reach to be kept at all.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `min` | integer | `1` | at least 1 | Shortest n-gram, in words. |
| `max` | integer | `4` | at least 1 | Longest n-gram, in words. |
| `min_occurrences` | integer | `3` | at least 1 | Occurrences a candidate expression needs to be kept. |
| `min_documents` | integer | `2` | at least 1 | Distinct files a candidate expression must appear in to be kept. |

### `inference.keyword_pages`

Publication threshold of a keyword page: a discovered expression gets a page under keywords/ only from min_occurrences occurrences in min_files distinct files, with a confidence of at least min_confidence; below it, it stays in the search index without a page.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `min_occurrences` | integer | `3` | at least 1 | Occurrences from which a discovered expression gets a page. |
| `min_files` | integer | `2` | at least 1 | Distinct files an expression must appear in to get a page. |
| `min_confidence` | number | `0.5` | 0 to 1 | Confidence, between 0 and 1, from which an expression at the threshold gets a page; below it the expression is suspected noise, listed on the to-do page, searchable, without a page nor a mark in the text. |

### `inference.neighbours`

Bound of the co-occurrence neighbourhood accumulated per node.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `k` | integer | `50` | at least 1 | Co-occurrence neighbours kept per node, ranked by shared paragraphs then by identifier; bounds the memory of the accumulation and the neighbours block of model.json. |

### `inference.duplicates`

How the twin resources of one document (a deck, its notes, its transcript) are reconciled: the signals of a pair are added, capped at 1, and the total decides between a merge and a W-DUP-CANDIDATE finding.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `mode` | enum | `"auto"` | `estimate`, `exact`, `auto` | estimate reports the MinHash estimate of the text similarity and never recomputes the exact index; exact recomputes it on every pair the banding brings together; auto recomputes it on the pairs estimated at exact_above or more. |
| `exact_above` | number | `0.5` | 0 to 1 | Estimated similarity from which auto recomputes the exact index on the full shingle sets. |
| `size_ratio_min` | number | `0.5` | 0 to 1 | Word-count ratio (shorter text over longer) under which the content signal is capped at 0.4 and the pair is reported as a likely inclusion rather than a duplicate. |
| `shingle_size` | integer | `5` | at least 1 | Words per shingle of the comparison form. |
| `minhash_functions` | integer | `128` | at least 4 | Hash functions of a MinHash signature, four per LSH band. |
| `merge_above` | number | `0.9` | 0 to 1 | Score strictly above which two resources merge into one entity with several representations. |
| `candidate_above` | number | `0.5` | 0 to 1 | Score from which a pair that does not merge yields a W-DUP-CANDIDATE finding. |

### `inference.domains`

Domains proposed from the neighbourhood graph: every term with a note whose degree reaches min_neighbours is a pivot, and every unclassified note within radius edges of one is a candidate for a domain named after it, reported as I-DOMAIN-SUGGESTED and listed in the build log. Absent, nothing is proposed.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `min_neighbours` (required) | integer | — | at least 1 | Degree in the graph of links and co-occurrences from which a term becomes a pivot; stopwords and the rejected terms of the lock file never do. |
| `radius` (required) | integer | — | 1 to 3 | Distance, in edges, within which a note belongs to a pivot; a note reached by several is attached to the closest, then to the one of highest degree. |
| `assign` | boolean | `false` | — | Whether the proposal files the unclassified notes it reaches under the domain named after their pivot, with the origin inferred; a note with a declared domain is never touched. |

## `conversion`

Office document conversion: its limits, its cache and its parallelism.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `timeout_s` | integer | `120` | at least 1 | Seconds allowed per document; a document past it yields W-CONV-FAILED and stays downloadable. |
| `max_size_mb` | integer | `50` | at least 1 | Size in megabytes above which a document is not converted and yields W-CONV-FAILED. |
| `cache` | string | `".concordance-cache"` | — | Cache folder, relative to this configuration and never published: the clones of the git sources under sources/, the converted documents under convert/ keyed by the SHA-256 of their source. |
| `parallelism` | integer | — | at least 1 | Concurrent conversions, the number of processor cores by default; changes the build time, never the output. |

## `build`

Where the build writes, what its pages embed and when it fails.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `output` | string | `"./dist"` | — | Folder that receives the site, model.json, build.log.json and the fragments, relative to this configuration; --output on the command line overrides it. |
| `fail_on` | object | — | — | The only thing that makes the build fail on content: every anomaly is recorded as a finding and the build goes on, then the verdict is decided here. See [`build.fail_on`](#buildfail_on). |
| `mentions_inline` | integer | `20` | at least 0 | Mentions of an entity served in the HTML of its page, readable without JavaScript; the rest is loaded from the fragments/<id>.mentions.json of the entity. |
| `extracted_text_max_chars` | integer | `20000` | at least 0 | Characters of the body of an entity that enter the search index: the plain text of its note today, the text extracted from its converted documents when conversion exists; the rest of the text is not searchable. |

### `build.fail_on`

The only thing that makes the build fail on content: every anomaly is recorded as a finding and the build goes on, then the verdict is decided here.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `errors` | boolean | `true` | — | Whether any error finding makes the build exit with code 1. |
| `unconverted_max` | integer | `10` | at least 0 | Number of unconverted documents above which the build fails. |

## `site`

Options of the generated pages.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `url` | string | — | pattern `^https://[^\s]+$` | HTTPS address the site is published at, its path included when the host serves it under one. The page served for a missing address, 404.html, links back through it; without it, that page assumes the site stands at the root of its host. |
| `publish_every_days` | integer | — | at least 1 | Days between two publications, as the pipeline is scheduled. Past three times that many days, every page tells its reader how old the site is; without it, no page does. |
| `neighbourhood` | object | — | — | The neighbourhood mini-map of a page. See [`site.neighbourhood`](#siteneighbourhood). |

### `site.neighbourhood`

The neighbourhood mini-map of a page.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `size` | integer | `6` | 1 to 12 | Nodes of the neighbourhood mini-map of a page; the map stays legible up to twelve. |

## `checks.*`

Overrides of the check registry, by check identifier: disable a check or change the severity of its findings. An identifier no loaded check registers is an execution error.

| Key | Type | Default | Allowed values | Description |
|---|---|---|---|---|
| `severity` | enum | — | `error`, `warning`, `info` | Severity given to every finding of the check, replacing its default. |
| `enabled` | boolean | `true` | — | Whether the check runs; false drops its findings from the build log and the model. |
