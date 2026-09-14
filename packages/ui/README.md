# @concordance-wiki/ui

A placeholder for the client components of Concordance to come: the mentions panel, the mini-map, the viewer slots and the pinned pages as components a theme can reuse on their own. Nothing is exported yet; the components of the published site live in `@concordance-wiki/site` for now. Installed by nothing; there is no reason to install it before a version says otherwise in its changelog.

## Install

```bash
npm install @concordance-wiki/ui
```

## Use

```ts
import * as ui from "@concordance-wiki/ui";

Object.keys(ui); // []
```

## What it contains

- An empty entry point, `dist/index.js`, so that the package name is reserved and its version moves with the others.

## Documentation

- [Theming](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/theming.md), where the islands and the components of the site are described today
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/packages/ui/CHANGELOG.md)

## Inside

The islands of the site (mentions panel, table of contents, tabs, pinned pages, side panels, mode switch, contract viewer, document viewer) are implemented in the site package, next to the default theme that composes them, and bundled by it. This package will take the ones that make sense on their own once a second theme needs them without the default one.

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.
