---
"@concordance-wiki/typing": minor
"@concordance-wiki/checks": minor
---

Global domains and applications: `compileDomains` and `resolveDomain` file every note under the frontmatter `domain`, else under the deepest domain whose globs match its source-relative path (globs are declared once and evaluated across every source), else under `unclassified` with `W-DOMAIN-UNCLASSIFIED`; `resolveApplication` takes the frontmatter `application`, else a rule's `set.application`, else the source's, and reports `W-APP-MISSING` when none applies; a value the configuration does not declare is kept as written and reported as `W-DOMAIN-UNKNOWN` or `W-APP-UNKNOWN`. The typing step is the producer of these findings, so the checks catalogue registers them as step checks and no longer computes `W-APP-MISSING` and `W-DOMAIN-UNCLASSIFIED` from the model; it also registers `W-TYPE-UNKNOWN` and `W-ATTRIBUTE-UNKNOWN`.
