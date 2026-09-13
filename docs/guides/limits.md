# What the tool does not do

One line each, so that nobody discovers a limit after the first build. The first list is by design and will stay; the second is the state of this version, and the [specification](../spec/mvp.md) says what the later batches bring.

## By design

- It never writes into a knowledge repository; the one exception is `lint --fix`, which writes only the corrections it printed, never an inferred link.
- It does not read source code: the model describes what the system does for its users, technical contracts are imported (OpenAPI, WSDL), never code.
- It does not run a server: the site is static, works over `file://`, and everything that needs a server (semantic search, questions in natural language, suggestions, merge request creation) belongs to a separate, optional service that is not part of this version.
- It does not edit notes: there is no editor, no comment, no "save" in the site; the edit link of a page opens the file in the forge.
- It does not model: no diagram is drawn, no BPMN, no navigation map, no CRUD matrix, no lineage; the site relates files by occurrence and shows the evidence.
- It does not decide whether transcripts may be published: pseudonymisation is a mechanism, `privacy.publish_transcripts` is off by default, and [Publishing transcripts](publishing-transcripts.md) lists what a person settles first.
- It does not show the confidence score nor lets a reader tune it: the score orders mentions and decides what is displayed, and no slider adjusts it.
- It does not read wikilinks, directives or any syntax beyond CommonMark, GFM tables and task lists, and optional YAML frontmatter.
- It stores no token: credentials for private sources come from the git environment of the machine or of the pipeline.
- It reads no issue tracker, test report or code analysis: `kind: tracker` sources are accepted by the schema and ignored.

## In this version

- Search matches by prefix only: `key` finds "Keyword page", a misspelt word finds nothing, and there is no semantic search; the results have no facets yet, the counts by type, source, domain and application come next.
- The build is not incremental: every run recomputes the whole model from the sources; only the clones of the git sources and the converted documents are kept in the cache. [Operations](operations.md#what-to-expect) gives the durations.
- Office conversion needs the LibreOffice plugin and its command: without them, documents stay downloadable entities without preview or extracted text, and none is counted as unconverted. No thumbnail is produced yet, and transcripts are not pseudonymised yet: `privacy.pseudonymize` is validated, not applied.
- The lock file is not read by the build: `lock:` is accepted with a warning from `validate-config`; accepted links, rejected links and rejected terms wait for a producer.
- `W-STALE` is catalogued but not produced; the home page flags dormant sources with the same thresholds instead.
- Cross-source links are off by default (`inference.cross_source_links`), and a link to another repository is left to `lint --scope global` when the build does not resolve it.
- Over `file://`, a page may not fetch: an entity with two hundred mentions or more shows the first `build.mentions_inline` of them and a link to its fragment, and the button that loads the rest in place works behind a server only; under two hundred, every mention travels in the page.
- Two locales ship, `en` and `fr`; another language needs a plugin that registers its language pack, and the interface labels of a locale without a catalogue fall back to English.
- The human steps stay human: enabling GitHub Pages, giving the pipeline a token for private sources, publishing the container image to Docker Hub, cutting a release ([Operations](operations.md#the-human-steps)).
