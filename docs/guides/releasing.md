# Releasing

This page describes how a version of Concordance is cut and what it produces. The publication pipelines are not enabled yet: until they are, the steps under "Publish" are run by hand by a maintainer, and the page is the contract they follow.

## What a release contains

A release publishes, under one version number:

- the npm packages `@concordance-wiki/*` (`core`, `profile`, `ingest`, `typing`, `nlp`, `inference`, `checks`, `site`, `ui`, `cli`, `lint`, every `plugin-*`) and the `concordance` preset;
- the container image `concordancewiki/concordance`, tagged with the version and with `latest`;
- a git tag `v<major>.<minor>.<patch>` on `main`, and a GitHub release whose notes are the changelog entry.

Every package is published under the [GNU General Public License, version 3 or later](../../LICENSE); the [licence inventory](../licenses.md) is regenerated and verified before every release.

## Versions

Versions follow [Semantic Versioning](https://semver.org/). Before `1.0.0`, a minor version may break compatibility and says so in its changelog entry; a patch version never does.

The packages of the workspace share one version number: a release bumps every published package, even one that did not change, so that `@concordance-wiki/*` packages of one version always work together. This is configured in `.changeset/config.json`.

The contract that a version commits to:

- the configuration schema (`concordance.yaml`) and the `model.json` schema, both published by `@concordance-wiki/core`;
- the command line (`build`, `export`, `init`, `validate-config`, `lint`, `gallery`) and its exit codes;
- the plugin API of `@concordance-wiki/core`;
- the default profile.

A breaking change to any of those is a major version once `1.0.0` is reached.

## Changesets

Every pull request that changes a published package adds a changeset file under `.changeset/`, written with `pnpm changeset`: the packages it touches, the bump (`patch`, `minor`, `major`) and one sentence for the changelog, in English, in the active voice, from the user's point of view ("Reads VTT transcripts with addressable timecodes", not "Added VTT support"). A change that touches no published package (documentation, scripts, fixtures) adds none.

The changelog of each package (`CHANGELOG.md`) is generated from the changesets: nobody edits it by hand.

## Cutting a release

1. Start from a clean `main` that passed the full pipeline, on a machine with the Node.js version of `.nvmrc`.
2. Run `pnpm check`: it must pass, including the licence inventory (`pnpm licenses:check`).
3. Apply the changesets: `pnpm changeset version`. This bumps the versions, updates every `CHANGELOG.md` and deletes the consumed changeset files. Read the resulting diff: a changelog entry that a user would not understand is rewritten in the changeset before continuing, not in the changelog.
4. Open a pull request titled `chore(release): v<x.y.z>` with that diff, and merge it once the pipeline is green.
5. Tag the merge commit: `git tag -a v<x.y.z> -m "v<x.y.z>"` and push the tag.
6. Publish (below).
7. Create the GitHub release from the tag, with the changelog entries of the version as its notes.

## Publish

Until the npm pipeline exists, a maintainer runs the steps from the tagged commit:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm changeset publish            # publishes every package whose version is not on npm yet
```

`pnpm changeset publish` publishes with the `access: public` setting of `.changeset/config.json` and creates nothing else: the tag comes from step 5 above, so that the tag and the packages point at the same commit.

When the npm pipeline is enabled, a push of a `v*` tag will run these steps in continuous integration, with provenance attestations for the packages, and the manual procedure will stay documented here as the fallback.

## Container image

The `image` workflow runs on every tag `v*` (and on pull requests that touch the image inputs, without publishing). It builds `concordancewiki/concordance` from the `Dockerfile` at the root of the repository with the version of the tag, checks that the image runs unprivileged as uid 1000 with the `concordance` entry point, LibreOffice, git and the fonts, builds the golden corpus once inside the container and once outside with the same `SOURCE_DATE_EPOCH`, compares the two output trees byte for byte with `scripts/compare-builds.mjs`, verifies that the container writes nothing but `dist/` and the cache, and measures the image with `docker image inspect`.

The image size is written to the summary of the run under "Container image"; copy it into the release notes so that integrators see the weight of what they pull. The `publish` job pushes the image tested above under `concordancewiki/concordance:<version>` and `:latest`; it is disabled in the workflow until the first release. Enabling it takes three steps by the maintainer of the Docker Hub account: create the repository, add the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets (a read-write access token, not the account password), and replace the `if: false` of the job with `startsWith(github.ref, 'refs/tags/v')`.

## Support

- The latest minor version receives fixes. Older versions receive none: upgrading is the fix.
- Security fixes follow the [security policy](../../SECURITY.md).
- Node.js: every release supports the active LTS versions of Node.js at the time of the release, and declares the minimum in the `engines` field of every package. When a Node.js version reaches end of life, the next minor version of Concordance drops it and says so in its changelog.
- The container image carries a supported Node.js version and LibreOffice; it is rebuilt with every release, never in between.

## Checklist

- [ ] `pnpm check` green on `main`
- [ ] every changeset reads well from the user's point of view
- [ ] `pnpm changeset version` applied through a merged pull request
- [ ] tag `v<x.y.z>` pushed on the merge commit
- [ ] packages published; `image` workflow green, image pushed with the version tag and `latest`, its size copied into the release notes
- [ ] GitHub release created with the changelog entries
