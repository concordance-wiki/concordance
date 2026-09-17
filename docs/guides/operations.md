# Operations

What running Concordance costs and needs: the build time and the weight to expect, what the cache holds, what the container image carries, and the steps no pipeline does for you. The [getting-started guide](getting-started.md) walks through the commands; this page is for the person who keeps the wiki running.

## What to expect

Measured on the golden corpus, `fixtures/corpora/realistic/en`, with `pnpm measure --steps` (`scripts/measure.mjs`: the corpus is copied to a temporary folder, built twice in a row with `--timings`, and the outputs weighed; the second table lists the steps that took a twentieth of the build or more). The figures below are those of a laptop; a pipeline runner is slower by a small factor, not by an order of magnitude.

Measured on 2026-09-17 (10 cores, arm64, Node.js 22.17.1).

| Measure | Value |
|---|---|
| Corpus | 120 markdown files in 5 sources, 60 kB |
| First build | 2.2 s |
| Second build, same folder | 2.1 s |
| Pages | 512 |
| Site as served (pages, assets, search index, mentions) | 14.5 MB |
| Pages alone | 12.7 MB, largest 105 kB |
| Search index | 148 kB |
| Mentions fragments | 1265 kB |
| `model.json` | 2.4 MB |
| Note fragments | 0.6 MB |
| `build.log.json` | 188 kB |
| `dist/` in full | 17.8 MB |

| Step | Second build | Share |
|---|---|---|
| render site | 1.5 s | 83 % |
| 24 other steps | 0.3 s | 17 % |

How to read them:

- Where the time goes: the rendering of the site takes four fifths of a build, the twenty-four steps of the pipeline the rest; `concordance build --timings` prints the same lines for any corpus, after the summary and never in the log. The rendering is linear in the number of pages, a few milliseconds each, so a corpus ten times larger renders in ten times the time.
- The second build is not incremental: the build recomputes everything from the sources on every run, and the only thing it keeps from one run to the next is the cache folder, the clones of the git sources and, once a converter is wired, the converted documents. Two builds of the same sources therefore cost the same, which is what makes the output reproducible.
- The pipeline is linear in the volume of text. The occurrence scan reads every note once per locale with one dictionary; the keyword discovery reads the n-grams of every text unit once; the twin-resource pass compares MinHash signatures, so it stays close to linear until thousands of resources. Expect seconds for a few hundred notes and a minute for a few thousand, plus the clone time of the sources on the first run.
- A page weighs from three to thirty kilobytes: the note, the section headings, the neighbourhood, the first twenty mentions and the mode switch, everything readable without JavaScript. The largest page of the corpus is the alphabetical index, which is split by letter as soon as it would pass 100 kB. The budget is 150 kB per page, checked on every build; an entity cited everywhere is the one that grows.
- The search index under `search/` is a set of small scripts, the entity table (`meta.js`, about 60 kB on the corpus) and one shard per two-character prefix, the largest under 4 kB: a page loads the table when the field takes focus and one shard per word typed, never the whole index. It grows with the text of the notes, each body counted up to `build.extracted_text_max_chars`, and the summary reports its weight and shard count on every build.
- `model.json` and the note fragments are written for `concordance render` and for the exporters. They ship with `dist/` by default; leave them out of the copy when publishing weight matters, and keep the `fragments/<id>.mentions.json` files, which the mentions panel loads on demand. The next section says which files the site needs.
- Office conversion, once wired, is the only step that costs seconds per document rather than milliseconds: two to ten seconds per office file on the first build with LibreOffice, nothing on the next ones for unchanged files thanks to the cache.

Refresh the tables after a change of the pipeline: `pnpm build && pnpm measure --steps`, then paste the output here with its date.

## What `dist/` holds

| Path | Served by the site | Needed by `concordance render` |
|---|---|---|
| `index.html`, `<id>/index.html`, `index/`, `todo/`, `keywords/` | yes | written by it |
| `assets/` (stylesheet, island bundles, logo, favicon) | yes | written by it |
| `search/` (results page, entity table and shards of the index) | yes | written by it |
| `fragments/<id>.mentions.json` | yes, loaded on demand by the mentions panel | written by it |
| `fragments/<id>.json` and `fragments/<id>/` (rendered notes and their images) | no | yes |
| `model.json` | no | yes |
| `build.log.json` | no | no |

Copy the first four rows to publish the site alone; copy everything to be able to render it again from the published folder, or to let `concordance lint --scope global` of a knowledge repository read the published `model.json`.

## The cache

Every file of the cache is written next to its destination and renamed into place, so an interrupted build leaves a file whole or absent; a cache file that is not what the build writes (truncated, or written by a previous version of a reader) reads as absent and is produced again, the build reporting a text representation it cannot read rather than stopping on it.

`.concordance-cache/` next to `concordance.yaml` (`conversion.cache` moves it) holds the clones of the git sources under `sources/<name>/`, made with the whole history but without the blobs (`--filter=blob:none`, so that `git log` dates every file by its last commit and the checkout fetches only the files of the tip; a server that ignores the filter gives a full clone, which works the same), updated on the next build and completed when an earlier version left them shallow, and will hold the converted documents under `convert/`, keyed by the SHA-256 of their source so that an unchanged document is never reconverted, even when it moves. Nothing in it is needed to publish; nothing in it is secret either, beyond what the sources themselves contain. Keep it out of the configuration repository (`.gitignore`) and inside the pipeline cache (the [pipeline examples](pipelines.md) do), and delete it to force fresh clones and a full reconversion. The linter keeps its own cache, the published model of the global scope, under `.concordance-cache/lint` of the knowledge repository.

## Container image

`concordancewiki/concordance` is published on Docker Hub at every release, tagged by version and `latest`, and built from the `Dockerfile` of the repository. It carries Node.js LTS, the `concordance` preset with every official plugin, git, headless LibreOffice and the fonts the conversion needs (metric-compatible substitutes for the usual office fonts, and a fallback face). Its entry point is the `concordance` command, so every command runs the same way with the configuration repository mounted on `/wiki`:

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance init
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance validate-config
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance build
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance lint
```

`build` writes `dist/` into the mounted folder, next to `concordance.yaml`, like the installed command. The cache lives under `/wiki/.concordance-cache`; mount a named volume there so that the clones and the converted documents survive from one run to the next without landing in the configuration repository:

```bash
docker run --rm -v "$PWD:/wiki" -v concordance-cache:/wiki/.concordance-cache concordancewiki/concordance build
```

The image runs unprivileged, as the user `concordance` (uid 1000), and writes nothing but `dist/` and the cache. On Linux the files it writes belong to uid 1000; when your user has another uid, run the container as yourself so that `dist/` stays yours: `--user "$(id -u):$(id -g)"` (the mounted folder and the cache volume must then be writable by that user). Docker Desktop on macOS and Windows maps the ownership for you. `SOURCE_DATE_EPOCH` is not set in the image: pass it (`-e SOURCE_DATE_EPOCH=0`) for a [reproducible build](command-line.md#reproducible-builds).

The `image` workflow of the repository builds the image on every release tag, checks the entry point, the user and the system tools, builds the golden corpus once inside the container and once outside and compares the two trees byte for byte, then measures the image; its size is written to the summary of the run and belongs in the release notes. The [release guide](releasing.md#container-image) says how the publication to Docker Hub is enabled.

## Reproducible builds

Two builds of unchanged sources write byte-identical files, so that `dist/` can be diffed against the previous publication, or committed. Every list is written in a canonical order and nothing in the outputs depends on the clock, except the `at` field of the build log and of the `build` block of `model.json`; `SOURCE_DATE_EPOCH`, a number of seconds since the epoch, pins that field too, as reproducible-builds tooling does. The repository verifies this on every change: the golden corpora are built twice and every file of the two output folders is compared (`scripts/determinism.mjs`).

## The commands the build runs

The build runs `git` for every git source, and the conversion plugin runs LibreOffice. Every request the build or the linter makes over the network, a contract declared by a URL or the published model of the global scope, is given thirty seconds and fifty megabytes: a server that never answers or a response that never ends is reported (`W-CONTRACT-UNREACHABLE`, or the linter falling back on its cached copy) instead of holding the run. A command is located by an absolute path, never by a name looked up on the `PATH` of the process: `git` is taken from the system directories of the platform (`/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin` on macOS; `C:\Program Files\Git\cmd` on Windows), so that a folder a build could write to never supplies a command. A machine that keeps git elsewhere names it through the `CONCORDANCE_GIT` environment variable; without a git in those places the build stops with an error that says so. Git never waits for anyone: its terminal prompt is off, Git Credential Manager is told not to ask (`GCM_INTERACTIVE=Never`), ssh runs in batch mode unless `GIT_SSH_COMMAND` or `GIT_SSH` names another command, and one git command may take fifteen minutes, or the seconds `CONCORDANCE_GIT_TIMEOUT` gives, before the build stops it and reports the source unreachable. The scripts of the repository follow the same rule for `git` and for `pnpm` (the pnpm running the script, else `PNPM_HOME`, else the corepack shipped with Node.js).

## Failure and exit codes

A content anomaly never stops a build: a file that is not UTF-8, a broken frontmatter or an unreachable source becomes a finding, printed on stderr and written to `dist/build.log.json` with the summary. Whether the build fails is decided by `build.fail_on` alone: by default, any error finding or more than ten unconverted documents. The exit codes are the same for every command: 0 when it did its job, 1 when the configuration, the profile, the theme or the findings refuse it, 2 when it could not run (a missing file, a plugin that cannot be loaded, an unknown option). The log, the model, the fragments and the site are written before the verdict, so a failing build still leaves them for inspection; a pipeline that publishes only on success gets the last good site, a pipeline that publishes `dist/` whatever the code gets the current one with its findings.

## The human steps

The pipelines do everything but these, which a person does once:

- GitHub Pages: set Pages → Source to "GitHub Actions" in the settings of the configuration repository; GitLab Pages needs nothing.
- Credentials for private sources: a token or a deploy key in the secrets of the pipeline, given to git as [private repositories](configuration.md#private-repositories) shows; the configuration never carries one.
- Publishing transcripts: `privacy.publish_transcripts: true` is a decision, not a setting; [Publishing transcripts](publishing-transcripts.md) lists what to settle before the first build that publishes one.
- The Docker Hub publication of the image: the maintainer of the account creates the repository, adds the two secrets and enables the `publish` job, as the [release guide](releasing.md#container-image) describes.
- The npm publication of the packages: the maintainer of the npm account creates the `concordance-wiki` organisation, configures trusted publishing for every package or stores an automation token as the `NPM_TOKEN` secret, creates the `lint-action` repository on GitHub and the `lint` project on GitLab with their tokens as secrets, and enables the `publish` job of the `release` workflow, as the [release guide](releasing.md#publish) describes; nothing is published until then.
- Releases: the pipeline opens the version pull request from the merged changesets, and merging it tags the commit and publishes the GitHub release; the merge is the human decision, and the settings that let the pipeline open pull requests are set once ([Releasing](releasing.md)).
