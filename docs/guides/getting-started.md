# Getting started

From nothing to a published wiki in one sitting: install the command line, describe your repositories in one file, build, look at the result, publish it on the pages of your forge, and let every knowledge repository check itself on its merge requests. The whole walk takes under thirty minutes on the golden corpus that ships with the tool; `scripts/walkthrough.mjs` runs every command of this page on that corpus at each change of the repository, so what is written here is what the command line does.

Concordance is pre-alpha. The packages and the container image are not on a public registry yet; until they are, the [checkout](#from-a-checkout) form below is the one that works, and the others describe what the release will give.

## Requirements

- Node.js 22 (see `.nvmrc`) and git, or a container engine with the [image](#with-the-container-image), which carries both.
- Nothing else for the notes. LibreOffice, for the office documents and the PDF sources the [conversion plugin](../../plugins/convert-libreoffice/README.md) turns into pages of text and previews; without it, those documents stay downloadable. The [limits](limits.md) page says what is not there yet.

## 1. Install

### From the published package

```bash
npm install --global @concordance-wiki/concordance
concordance --help
```

The `@concordance-wiki/concordance` package is a preset: it installs the core and every official plugin, and provides the `concordance` command (`conc` for short). `npx @concordance-wiki/concordance <command>` runs it without installing.

### With the container image

```bash
docker run --rm -v "$PWD:/wiki" concordancewiki/concordance --help
```

`concordancewiki/concordance` runs the same command line without Node.js on the host; its entry point is the `concordance` command and the configuration repository is mounted on `/wiki`. Every command of this page runs the same way, `build` writing `dist/` into the mounted folder. The [operations guide](operations.md#container-image) says what the image carries, which user it runs as and how to keep its cache between runs.

### From a checkout

```bash
git clone https://github.com/concordance-wiki/concordance.git
cd concordance
pnpm install --frozen-lockfile
pnpm build
alias concordance="node $PWD/packages/cli/dist/bin.js"
```

The built command line is `packages/cli/dist/bin.js`; the alias makes the rest of this page read the same. The golden corpus is at `fixtures/corpora/realistic/en` in the same checkout.

## 2. Create a configuration repository

A Concordance site is described by one repository that holds the configuration, the theme and the stopwords. It never holds content.

```bash
mkdir my-wiki && cd my-wiki
git init
concordance init --templates
concordance validate-config
```

`init` writes a minimal, commented `concordance.yaml` and refuses to overwrite one that exists; `--templates` adds the [note templates](../templates/README.md), one per type, under `templates/`, to copy into a knowledge repository whenever you start a note. `validate-config` prints `concordance.yaml: valid configuration`: the file declares one local source, `./notes`, so that the next step works on any folder of markdown files put there.

## 3. Point the configuration at your repositories

Edit `concordance.yaml`. Two sources are enough for a first wiki: a glossary, whose titles win when a word could mean two things, and a repository of specifications with a couple of typing rules:

```yaml
version: 1
project:
  name: My wiki
  locale: en
sources:
  - name: glossary
    git: https://example.invalid/knowledge/glossary.git
    type: term
    glossary: true
  - name: specs
    git: https://example.invalid/knowledge/specs.git
    rules:
      - match: { path: "screens/**" }
        set: { type: screen }
      - match: { suffix: ".rule.md" }
        set: { type: rule }
```

`example.invalid` is a placeholder: put the URLs of your own repositories, and see [private repositories](configuration.md#private-repositories) when they need credentials. A local folder works too (`path: ../glossary` instead of `git:`), and that is how the golden corpus is declared: to try the tool on it before touching your own notes, copy `fixtures/corpora/realistic/en` somewhere and use it as the configuration repository, its `concordance.yaml` declares five local sources about Concordance itself.

```bash
cp -R path/to/concordance/fixtures/corpora/realistic/en my-wiki && cd my-wiki
concordance validate-config
```

Everything beyond `name` and `git` or `path` is optional; the [configuration guide](configuration.md) says what the other keys add, the [reference](../reference/configuration.md) lists them all.

## 4. Build

```bash
concordance build
```

The build validates the configuration, clones every git source into `.concordance-cache/`, history included, blobs fetched on checkout only (add that folder to `.gitignore`), reads every markdown file, types the notes, recognises the words of the glossary in every text, links the notes, discovers the recurring expressions nobody defined, runs the checks and writes `dist/`. It prints every finding on stderr and a summary on stdout: entities per type, links per method, keyword pages, findings per check, then the pages written, the largest one against the 150 kB budget and the weight of the search index. On the golden corpus it takes about a second and ends with a `site: … pages written` line; the warnings and informations it reports are the ones the corpus is built to produce, listed in its [README](../../fixtures/corpora/realistic/README.md). The exit code is 0 unless an error finding exists (`build.fail_on` decides), and the site is written either way. [The command line](command-line.md#build) details every step and file.

## 5. Open the site

Open `dist/index.html` in a browser, from the file manager or with `open dist/index.html` / `xdg-open dist/index.html`. No server is needed: every link is relative and every page is a folder holding an `index.html`, so the site reads over `file://` as it does behind a server. From the home page, follow a word of the search region, the file tree of a source, a letter of the alphabetical index or the to-do page, which lists the words without a note; type in the search field of any page, or press `/` to reach it, and the results appear as you type, without a server; on the results page, narrow them with the facets on type, source, domain and application, whose counts follow the query; the address of the page carries the query and the filters, so a search can be sent as a link and replays exactly; the words without a note appear among the results in a dotted row, and a facet isolates or excludes them. The [command line guide](command-line.md#the-site) says what each file of `dist/` is, and [Search](command-line.md#search) how the field matches and how the facets combine.

Changed the theme or the labels? `concordance render` writes the pages again from `dist/model.json` without cloning anything.

## 6. Publish

`dist/` is a static folder: copy it to GitHub Pages, GitLab Pages, an object storage bucket served as a website or any web server, at the root of a domain or under a prefix. Commit `concordance.yaml` (never `dist/` nor `.concordance-cache/`), push the configuration repository to your forge and add the pipeline of your forge; both are in [Pipelines](pipelines.md), complete and copyable:

- GitHub: [`.github/workflows/wiki.yml`](pipelines.md#github-pages), then Settings → Pages → Source: GitHub Actions, once.
- GitLab: [`.gitlab-ci.yml`](pipelines.md#gitlab-pages); the `pages` job publishes `public/` without any setting.

Both examples build on every push to `main` and every morning, so that the wiki follows the knowledge repositories without anyone touching the configuration one. Two builds of unchanged sources give byte-identical files (set `SOURCE_DATE_EPOCH` to pin the only timestamp), so a published site can be diffed against the previous one.

## 7. Lint in a merge request

Each knowledge repository checks itself before its notes reach the wiki: broken links, duplicate identifiers, invalid frontmatter, wrong encoding. From the root of a repository:

```bash
npx concordance lint
```

prints one line per finding and a count, and exits 1 when an error remains. In a merge request, `--format sarif` on GitHub and `--format junit` on GitLab put each finding in the margin of the diff; [Pipelines](pipelines.md#lint-in-a-merge-request) has the two workflows, and [Distributing the linter](lint-distribution.md) the one-line action, component, binary, image and pre-commit hook that run the same command. `--fix` corrects what is mechanical, `--scope global` also checks the links to the other repositories against the published `model.json`; see [`lint`](command-line.md#lint).

## Where to go next

- [Writing notes](writing-notes.md): what a note is, what frontmatter adds, which sections mean something.
- [Configuration](configuration.md) and its [reference](../reference/configuration.md): sources, typing rules, domains, thresholds, checks.
- [Operations](operations.md): what to expect in build time and weight, the cache, the container image, the human steps.
- [What the tool does not do](limits.md): the limits of this version, one line each.
- [Theming](theming.md): the name, logo, colours and labels of the site.
