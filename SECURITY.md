# Security policy

## Supported versions

Concordance is pre-alpha: no version is published yet, and this policy applies from the first published release. From then on, fixes go to the latest minor version only.

| Version | Supported |
|---|---|
| latest minor (`x.y.*`) | yes |
| earlier minor versions | no: upgrade to the latest |
| `main` between releases | best effort, no security fix is backported to it separately |

## Reporting a vulnerability

Do not open a public issue for a vulnerability, and do not describe it in a pull request.

Report it privately, either:

- through the private vulnerability reporting form of the repository on GitHub ("Report a vulnerability" under the Security tab), which is preferred because it keeps the exchange in one place, or
- by email to the maintainer, <qnjoly@gmail.com>, with "security" in the subject.

Include:

- the affected package (`@concordance-wiki/*`, the `concordance` preset or the container image) and its version, or the commit of `main`;
- a minimal reproduction: the configuration, the smallest content that triggers the issue and the command that was run;
- the impact you foresee: what an attacker controls (a note in a source repository, a configuration file, a document to convert) and what they obtain (files read outside the sources, content written into a source, code run at build time, data leaked into the published site);
- whether the issue is already public elsewhere.

You will receive an acknowledgement within seven days and a first assessment within thirty days. The assessment says whether the report is accepted as a vulnerability, its severity, and the version that will carry the fix.

## Disclosure

The disclosure window is 90 days from the acknowledgement: the fix is published, with a security advisory that credits the reporter unless they prefer otherwise, at the latest 90 days after the report, or earlier as soon as a fixed version is available. When a fix needs longer, the maintainer says so before the window ends and agrees on a new date with the reporter. A vulnerability that is being exploited is disclosed as soon as a fix exists, whatever the window.

Reporters are asked to keep the report private until the advisory is published, and to avoid accessing or altering data that is not theirs while demonstrating the issue.

## Scope

In scope: the packages published under `@concordance-wiki/*` and `concordance`, the container image, the generated site, the linter and its distributions.

Out of scope: the content of knowledge repositories you feed to the tool, the hosting of the generated site, third-party services referenced by a contract, vulnerabilities in dependencies that have no effect on Concordance (report those upstream).

## What the tool does with your data

The build reads repositories you declare, writes nothing into them, and produces a static site. The pseudonymisation dictionary, when used, is never written into the output, and transcripts are published only when the configuration asks for it explicitly; [Publishing transcripts](docs/guides/publishing-transcripts.md) sets out what to settle before doing so. The published site contains everything the build indexed: review what you publish.
