---
"@concordance-wiki/cli": minor
---

Distribute the linter in six forms that run the same command line and produce the same report: the `npx` package, a standalone binary built as a Node.js single executable application (`pnpm build:binary`), a GitHub action, a GitLab CI/CD component, the container image and a pre-commit hook, with a workflow that compares their reports on the faulty corpus.
