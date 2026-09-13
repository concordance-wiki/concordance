---
type: runbook
trigger: a red nightly build
owner: roles/maintainer
status: valid
---
# Rebuild the site after a red build

The nightly build of the wiki failed: its [build log](business_object.md) lists errors above the fail-on policy. The maintainer fixes the notes and rebuilds.

## Steps

1. Read the build log and the findings it lists, error first.
2. Fix the notes the errors point at, then run `concordance lint` in the repository.
3. Run `concordance build` again and open the [home page](screen.md) of the published site.

## Rules

- [Publication threshold](rule.md)
