---
lifecycle: [declared, cloned, read, stale]
---
# Source

A repository declared in the configuration, cloned at depth 1 on its ref and read at every build. Carries [resources](resource.md); a source whose head has not moved for the staleness threshold of its notes is reported as a whole.
