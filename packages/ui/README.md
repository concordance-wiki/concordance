<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/ui</h1>

<p align="center"><strong>Reserved for the client components of the site; nothing is exported in 0.1.x.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/ui"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/ui?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/theming.md">Theming</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/packages/ui/CHANGELOG.md">Changelog</a>
</p>

---

## Why

Concordance publishes a static wiki whose interactive parts, the mentions panel, the table of contents, the pinned pages, the side panels, the viewers, are components of the default theme. You install [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance) for that. This package holds the name under which those components will be published on their own, for a second theme that wants them without the default one. In 0.1.x it exports nothing; the components live in [`@concordance-wiki/site`](https://www.npmjs.com/package/@concordance-wiki/site). There is no reason to install it before a version says otherwise in its changelog.

## Quick start

```bash
npm install @concordance-wiki/ui
```

```ts
import * as ui from "@concordance-wiki/ui";

Object.keys(ui); // []
```

## What you get

- **An empty entry point**, `dist/index.js`, so that the package name is reserved and its version moves with the others.
- **Nothing else yet.** The islands of the site are described in the theming guide, where they live today.

## Documentation

- [Theming](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/theming.md), where the islands and the components of the site are described today
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/ui/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

The islands of the site (mentions panel, table of contents, tabs, pinned pages, side panels, mode switch, contract viewer, document viewer) are implemented in the site package, next to the default theme that composes them, and bundled by it. This package will take the ones that make sense on their own once a second theme needs them without the default one.

</details>
