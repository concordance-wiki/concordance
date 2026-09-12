# Security policy

## Supported versions

Concordance is pre-alpha. No version is supported yet. This policy applies from the first published release.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

Use the private vulnerability reporting form of this repository on GitHub ("Report a vulnerability" under the Security tab). You will receive an acknowledgement within seven days and a first assessment within thirty days.

Please include the affected package and version, a minimal reproduction, and the impact you foresee.

## Scope

In scope: the packages published under `@concordance-wiki/*` and `concordance`, the generated site, the linter and its distributions.

Out of scope: the content of knowledge repositories you feed to the tool, the hosting of the generated site, third-party services referenced by a contract.

## What the tool does with your data

The build reads repositories you declare, writes nothing into them, and produces a static site. The pseudonymisation dictionary, when used, is never written into the output. The published site contains everything the build indexed: review what you publish.
