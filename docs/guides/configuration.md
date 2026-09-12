# Configuration

Everything lives in a configuration repository: `concordance.yaml`, an optional `profile.yaml`, a `theme.yaml`, stopword files, `concordance.lock.yaml`, and, never versioned in a public repository, `pseudonyms.yaml`. `concordance validate-config` checks `concordance.yaml` against [`config.schema.json`](../../packages/core/schemas/config.schema.json) and prints the path of any faulty key, the value received and the values expected, then a verdict line. Exit codes: 0 valid, 1 invalid, 2 file not found. Beyond the schema, it rejects a source name used twice and a malformed domain glob, and it warns about keys that are accepted but ignored in this version (`lock`, tracker sources). `--config` (or `-c`) points at another file; the default is `concordance.yaml` in the current directory.

The reference below follows the schema. Every key not marked required is optional.

## `version`

Required. Schema version, currently `1`.

## `project`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | displayed in the site |
| `locale` | BCP 47 tag | `en` | interface language and default source locale; see [`sources[].locale`](#sources) for what a locale selects |
| `theme` | path | `./theme.yaml` | theme file |
| `edit_url` | string | — | pattern for the "edit in the forge" link, with `{source}`, `{path}` and `{commit}` placeholders |

## `profile`

Path to the project profile, merged over the default profile key by key. See [writing notes](writing-notes.md#profile) for what a profile can add.

## `plugins`

List of plugins to load, in order. Each entry is a package name or an object `{ name, options }`. The `concordance` preset loads every official plugin by default; list them explicitly to restrict or reorder.

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - name: "@concordance-wiki/plugin-convert-libreoffice"
    options: { timeout_s: 120 }
```

## `applications`

Containers of first level. Every entity is resolved to one; an entity without one yields `W-APP-MISSING`.

```yaml
applications:
  - id: policy-admin
    title: Policy administration
    status: active   # active | legacy | target
```

## `domains`

Global business domains, orthogonal to sources. Globs are evaluated on every source. Subdomains are resolved after their parent; the most specific wins. A frontmatter `domain` overrides globs. A note outside every domain goes to the unclassified domain and yields `W-DOMAIN-UNCLASSIFIED`.

```yaml
domains:
  - id: membership
    title: Membership
    match: ["**/membership/**", "**/member/**"]
    subdomains:
      - id: payments
        match: ["**/payment*/**"]
```

## `privacy`

| Key | Meaning |
|---|---|
| `exclude` | globs applied before any content is read |
| `pseudonymize.enabled` | replaces speaker names and detected personal mentions by stable pseudonyms; `false` by default |
| `pseudonymize.scope` | types concerned, `[meeting]` by default |
| `pseudonymize.dictionary` | path to `pseudonyms.yaml`, real name → pseudonym; never published |
| `pseudonymize.keep_roles` | keep the role instead of the pseudonym when known |
| `publish_transcripts` | `false` by default; transcripts are indexed only when explicitly requested |

## `sources`

One entry per repository or local folder. Names are unique.

| Key | Meaning |
|---|---|
| `name` | required, unique; first segment of every identifier from this source |
| `git` | repository URL; cloned at depth 1 |
| `ref` | branch, tag or commit; `main` by default |
| `path` | local folder, for development; exclusive with `git` |
| `locale` | BCP 47 tag (`en`, `fr`, `fr-CA`…); defaults to `project.locale`. Selects the language pack of the source: text normalisation, default stopwords, plural rules, word segmentation and the collation of its indexes, plus the profile's type prefixes for that locale. The engine ships `en` and `fr`; a regional variant uses the pack of its language; other languages come from plugins, which register their pack. A tag with no pack is a build error |
| `type` | forces the type of every markdown file |
| `default_type` | type when nothing else applies; `document` by default |
| `application` | default application for the source |
| `glossary` | `true` marks the source as a glossary: its titles and aliases take priority in the recognition dictionary |
| `convert` | `true` enables office conversion for this source |
| `previews` | `false` keeps previews out of the artefact for this source |
| `rules` | typing rules, evaluated in order; the last match wins |

A rule matches on `path` (glob), `suffix` (`.rule.md`), `ext` (`[".vtt"]`) or `frontmatter` (a key that must be present), and sets any attribute, most often `type`:

```yaml
sources:
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    application: policy-admin
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

Concordance never stores a token and never asks for one: `concordance.yaml` is versioned and often public. Credentials come from the git environment of the machine or pipeline, like any `git clone`, and the build disables git's terminal prompt so that a repository it cannot reach fails immediately with a `W-SOURCE-UNREACHABLE` finding instead of waiting for a password.

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

## `inference`

| Key | Default | Meaning |
|---|---|---|
| `glossary_sources` | sources with `glossary: true` | priority sources for the dictionary |
| `stopwords` | language pack | extra stopword files, one word per line, `#` starts a comment; added on top of the defaults of the language pack |
| `short_terms` | `[]` | allow-list of terms shorter than three characters |
| `type_prefixes` | language pack | words that announce a type (`screen`, `API`, `table`) and add 0.1 confidence; the defaults are those of the profile for the locale of the source |
| `cross_source_links` | `false` | resolve markdown links across sources with a `source:` prefix |
| `ngrams` | `{ min: 1, max: 4, min_occurrences: 3, min_documents: 2 }` | candidate expression discovery |
| `keyword_pages` | `{ min_occurrences: 3, min_files: 2 }` | publication threshold of a keyword page |
| `neighbours` | `{ k: 50 }` | neighbours kept per node |
| `candidate_score` | 4.0 | score above which a candidate yields `W-TERM-UNDEFINED` |

## `conversion`

| Key | Default | Meaning |
|---|---|---|
| `timeout_s` | 120 | per document |
| `max_size_mb` | 50 | larger files are not converted |
| `cache` | `.concordance-cache` | cache folder, outside `dist/` |
| `parallelism` | number of cores | concurrent conversions |

## `build`

| Key | Default | Meaning |
|---|---|---|
| `output` | `./dist` | site folder |
| `fail_on.errors` | `true` | fail when any error finding exists |
| `fail_on.unconverted_max` | 10 | fail beyond this many unconverted documents |
| `mentions_inline` | 20 | mentions served in the HTML before the JSON fragment |
| `extracted_text_max_chars` | 20000 | extracted text indexed per document |

## `checks`

Enable, disable or re-severitise a check:

```yaml
checks:
  W-TERM-UNUSED: { severity: info }
  W-STALE: { enabled: false }
```

The same block, in a `concordance-lint.yaml` at the root of a knowledge repository, overrides severities locally for the linter.

## `lock`

Path to `concordance.lock.yaml`. See [`schemas/lock.schema.json`](../../packages/core/schemas/lock.schema.json). Only `rejected_terms` is read in the first version.

## `theme.yaml`

See [`schemas/theme.schema.json`](../../packages/core/schemas/theme.schema.json) and the theme shipped in [`brand/theme.yaml`](../../brand/theme.yaml) as an example. Name, logo, favicon, fonts, radius, light and dark palettes, default mode, optional footer and an optional additional stylesheet. The accent colour never carries information on its own.

## Continuous integration

Build and publish with GitHub Actions:

```yaml
name: wiki
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 5 * * *" }]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - run: npm install --global concordance
      - run: concordance build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

The same with GitLab CI:

```yaml
pages:
  image: node:lts
  script:
    - npm install --global concordance
    - concordance build --output public
  artifacts:
    paths: [public]
  cache:
    paths: [.concordance-cache]
```

Add LibreOffice to the image when office conversion is wanted. Keep `.concordance-cache` in the pipeline cache so that unchanged documents are not reconverted.
