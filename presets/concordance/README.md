# @concordance-wiki/concordance

Concordance, batteries included: the `concordance` command (alias `conc`) of `@concordance-wiki/cli` together with the official reader and converter plugins, so that a configuration can declare any of them without installing anything else. This is the package an integrator installs to build a wiki from repositories of markdown and documents; the container image is built from it.

Two packages give the same command:

- `@concordance-wiki/concordance`, this one, carries the plugins for transcripts (`.vtt`, `.srt`), office metadata (`.docx`, `.pptx`, `.xlsx`, `.pdf`) and office conversion through LibreOffice; declare in `concordance.yaml` the ones the wiki uses.
- `@concordance-wiki/cli` alone carries no plugin: install next to it the ones you pick, the contract plugins `@concordance-wiki/plugin-contract-openapi` and `@concordance-wiki/plugin-contract-wsdl` included, which this preset does not carry either.

## Install

```bash
npm install --global @concordance-wiki/concordance
concordance --help
```

`npx @concordance-wiki/concordance <command>` runs it without installing. The container image `concordancewiki/concordance` runs the same command without Node.js on the host, with LibreOffice and git inside.

## Use

From nothing to a built wiki:

```bash
mkdir my-wiki && cd my-wiki
concordance init --templates
concordance validate-config
concordance build
```

`init` writes a minimal, commented `concordance.yaml` declaring one local source, `./notes`; edit it to point at your repositories and to declare the plugins the wiki needs:

```yaml
plugins:
  - "@concordance-wiki/plugin-reader-vtt"
  - "@concordance-wiki/plugin-reader-office"
  - "@concordance-wiki/plugin-convert-libreoffice"
```

## What it contains

- `bin/concordance.js`, the `concordance` and `conc` executables, which run the command line of `@concordance-wiki/cli`: `build`, `render`, `export`, `init`, `validate-config`, `lint`, `gallery`.
- `@concordance-wiki/plugin-reader-vtt`: reader for `.vtt` and `.srt` transcripts.
- `@concordance-wiki/plugin-reader-office`: metadata reader for `.docx`, `.pptx`, `.xlsx` and `.pdf`.
- `@concordance-wiki/plugin-convert-libreoffice`: conversion of office documents to PDF and extraction of their text; needs LibreOffice on the machine.
- No code of its own.

## Documentation

- [Getting started](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md)
- [Command line](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/command-line.md)
- [Configuration reference](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md)
- [Operations](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/operations.md), the container image
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/presets/concordance/CHANGELOG.md)

## Inside

The package holds no code of its own: `bin/concordance.js` imports the executable of the command line, and the dependencies are what adds the plugins. The container image `concordancewiki/concordance` is built from this package by the `Dockerfile` at the root of the repository.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
