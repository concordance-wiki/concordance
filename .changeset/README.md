# Changesets

Every pull request that changes a published package adds a changeset with `pnpm changeset`; the pipeline checks it, and the label `no-changeset` lifts the check with the reason in the pull request. The version pull request consumes them to bump the versions and write the changelogs, as [the release guide](../docs/guides/releasing.md) describes.
