# Releasing

This page is the contract between the version number and what it promises. The versions are held by the pipeline: every merge on `main` that carries a changeset feeds one version pull request, merging that pull request tags the commit and publishes the GitHub release with its changelog and its assets. No step depends on anyone's memory, and the one decision that stays human is the merge.

## What a release contains

A release publishes, under one version number:

- a git tag `v<major>.<minor>.<patch>` on `main`, annotated;
- a GitHub release on that tag whose notes are the changelog entries of the version, with as assets the standalone binaries of the linter (`concordance-linux-x64`, `concordance-darwin-arm64`, `concordance-win32-x64.exe`, each with its SHA-256 next to it), the tarball of every published package as `pnpm pack` writes it, `checksums.txt` with the SHA-256 of every asset, and `licenses.md`, the [licence inventory](../licenses.md) verified on the released commit;
- the `CHANGELOG.md` of every package, next to it, written by Changesets;
- the container image `concordancewiki/concordance`, built and tested by the `image` workflow on the tag; its publication to Docker Hub stays disabled until the maintainer of the account enables it ([Container image](#container-image)).

Nothing is published to npm: the packages `@concordance-wiki/*` and the `concordance` preset are versioned, packed and attached to the release, not pushed to a registry. Enabling a registry publication is a decision of its own, taken outside this pipeline.

Every package is published under the [GNU General Public License, version 3 or later](../../LICENSE).

## Versions

Versions follow [Semantic Versioning](https://semver.org/). Before `1.0.0`, a minor version may break compatibility and says so in its changelog entry; a patch version never does. The first version is `0.1.0`, set by the first version pull request from the changesets accumulated since the start.

The packages of the workspace share one version number: a release bumps every published package, even one that did not change, so that `@concordance-wiki/*` packages and the `concordance` preset of one version always work together. This is the `fixed` group of `.changeset/config.json`.

The contract that a version commits to:

- the configuration schema (`concordance.yaml`) and the `model.json` schema, both published by `@concordance-wiki/core`;
- the command line (`build`, `export`, `init`, `validate-config`, `lint`, `gallery`) and its exit codes;
- the plugin API of `@concordance-wiki/core`;
- the default profile.

A breaking change to any of those is a major version once `1.0.0` is reached, and a minor version that says so before.

## Changesets

Every pull request that changes a published package adds a changeset file under `.changeset/`, written with `pnpm changeset`: the packages it touches, the bump (`patch`, `minor`, `major`) and one sentence for the changelog, in English, in the active voice, from the user's point of view ("Reads VTT transcripts with addressable timecodes", not "Added VTT support"). A change that touches no published package (documentation, scripts, fixtures, workflows) adds none.

The pipeline enforces it: the `check` job of every pull request runs `pnpm changeset status --since origin/main` and fails when a file under `packages/*`, `plugins/*` or `presets/*` changed without a changeset added by the same pull request. The label `no-changeset` lifts the check, for a pull request that touches a package without changing what it publishes (its tests, its typings, a comment); the reason is written in the pull request. Adding or removing the label runs the pipeline again.

The changelog of each package (`CHANGELOG.md`) is generated from the changesets: nobody edits it by hand. A changelog entry that a user would not understand is rewritten in the changeset before the version pull request is merged, and the pull request refreshes itself.

## What the machine does

1. **The version pull request.** On every push to `main`, the `release-pr` workflow reads the pending changesets. When there are some, it opens or refreshes the pull request `chore(release): v<x.y.z>` from the branch `changeset-release/main`: `pnpm changeset version` bumps the versions, writes the changelogs and deletes the consumed changesets; `pnpm install --lockfile-only` refreshes the lockfile; `node scripts/sync-distribution-versions.mjs` pins the GitHub action, the GitLab component and the pre-commit hook to the new version, and `scripts/check-distribution.mjs` verifies the pins as part of `pnpm lint`. The version is the one of `@concordance-wiki/cli` in the release plan; every published package takes it. The pull request is never merged automatically.
2. **The tag and the release.** The `release` workflow runs on every push to `main` that changes `packages/cli/package.json`. When the version differs from the one before the push, it creates the annotated tag `v<x.y.z>` on that commit and pushes it, builds the standalone binary on Linux x64, macOS arm64 and Windows x64 with `scripts/build-binary.mjs`, packs every published package with `pnpm pack` into `dist-release/`, verifies the licence inventory (`pnpm licenses:check`) and copies it there, writes `checksums.txt`, gathers the release notes from the changelogs (`scripts/release-notes.mjs <version>`: every entry of the version once, whatever the number of packages that carry it, by bump, then the packages at that version) and creates the GitHub release with `gh release create`, `--prerelease` when the version carries a prerelease suffix. It then dispatches the `image` workflow on the tag, since a tag pushed with the workflow token triggers no workflow by itself.
3. **The container image.** The `image` workflow builds and tests the image on the tag; its `publish` job stays disabled ([Container image](#container-image)).

A pull request that lands on `main` while a version pull request is open refreshes it: the versions and the changelogs of the pull request always reflect every changeset merged so far.

## What stays human

- **Merging the version pull request** is the decision to release. The maintainer reads the diff: the versions, the changelogs from the user's point of view, the lockfile, the distribution pins. A changelog entry that reads badly is fixed in its changeset on `main`, never in the pull request; the pull request refreshes itself.
- **Running the pipeline on the version pull request.** A pull request opened with the workflow token triggers no workflow. Either the maintainer closes and reopens it, which runs the pipeline as for any pull request, or the repository carries the secret `RELEASE_TOKEN`, a fine-grained token with write access to contents and pull requests, which the `release-pr` workflow uses when present so that the pipeline runs on the pull request as soon as it is opened.
- **Allowing the pipeline to open pull requests**: in the repository settings, Actions → General, "Allow GitHub Actions to create and approve pull requests" is enabled once.
- **The Docker Hub publication** of the image, as [Container image](#container-image) describes.
- **A registry publication** of the packages, if ever: a decision of its own, documented here when it is taken.

## Fallback: cutting a release by hand

When the pipeline cannot run, a maintainer does what it does, in the same order, from a clean `main` that passed the full pipeline, on a machine with the Node.js version of `.nvmrc`:

1. `pnpm check` must pass, including the licence inventory (`pnpm licenses:check`).
2. `pnpm changeset version && pnpm install --lockfile-only && node scripts/sync-distribution-versions.mjs`. Read the resulting diff.
3. Open a pull request titled `chore(release): v<x.y.z>` with that diff, and merge it once the pipeline is green. The `release` workflow takes over from the merge: a change of the version on `main` is a release, whoever made it.
4. Only when the `release` workflow cannot run either: tag the merge commit, `git tag -a v<x.y.z> -m "v<x.y.z>"`, push the tag, then from the tagged commit run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm build:binary` on each platform, `pnpm -r --filter './packages/**' --filter './plugins/**' --filter './presets/**' pack --pack-destination dist-release`, `sha256sum` over the assets into `checksums.txt`, `node scripts/release-notes.mjs <version> --output notes.md`, and `gh release create v<x.y.z> --verify-tag --notes-file notes.md dist-release/*`.

## Container image

The `image` workflow runs on every tag `v*` (and on pull requests that touch the image inputs, without publishing). It builds `concordancewiki/concordance` from the `Dockerfile` at the root of the repository with the version of the tag, checks that the image runs unprivileged as uid 1000 with the `concordance` entry point, LibreOffice, git and the fonts, builds the golden corpus once inside the container and once outside with the same `SOURCE_DATE_EPOCH`, compares the two output trees byte for byte with `scripts/compare-builds.mjs`, verifies that the container writes nothing but `dist/` and the cache, and measures the image with `docker image inspect`.

The image size is written to the summary of the run under "Container image"; copy it into the release notes so that integrators see the weight of what they pull. The `publish` job pushes the image tested above under `concordancewiki/concordance:<version>` and `:latest`; it is disabled in the workflow until the first release. Enabling it takes three steps by the maintainer of the Docker Hub account: create the repository, add the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets (a read-write access token, not the account password), and replace the `if: false` of the job with `startsWith(github.ref, 'refs/tags/v')`.

## Support

- The latest minor version receives fixes. Older versions receive none: upgrading is the fix.
- Security fixes follow the [security policy](../../SECURITY.md).
- Node.js: every release supports the active LTS versions of Node.js at the time of the release, and declares the minimum in the `engines` field of every package. When a Node.js version reaches end of life, the next minor version of Concordance drops it and says so in its changelog.
- The container image carries a supported Node.js version and LibreOffice; it is rebuilt with every release, never in between.

## Checklist, before merging a version pull request

- [ ] the pipeline is green on `main` and on the pull request
- [ ] every changelog entry reads well from the user's point of view
- [ ] a minor version before `1.0.0` that breaks the contract says so in its entry
- [ ] the versions, the lockfile and the distribution pins in the diff all carry `v<x.y.z>`

After the merge, the `release` workflow does the rest; check that the tag, the release and its assets exist, and copy the image size from the `image` run into the release notes.
