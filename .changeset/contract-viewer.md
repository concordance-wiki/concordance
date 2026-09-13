---
"@concordance-wiki/site": minor
"@concordance-wiki/cli": minor
"@concordance-wiki/core": minor
"@concordance-wiki/plugin-contract-openapi": minor
"@concordance-wiki/plugin-contract-wsdl": minor
---

Contract viewer: the page of an `api` entity whose contract was imported shows the contract after the note without copying it into the markdown, as a static section (title, version, import date, the operations as a plain list, a "Download the contract" link to the declared URL or to the copy of a path contract placed next to the page) and a `contract-viewer` island that fetches `fragments/<api id>.contract.json` on demand only and renders an expandable operation list and a schema explorer for HTTP and SOAP contracts alike, with no form and no request to the API described; the contract loader of the core writes that view next to the cached contract at every load (`ContractView`, `cachedContractViewPath`), the OpenAPI and WSDL readers now keep the parameters, request and response types and the referenced schema definitions for it, the build copies the view and the path contract under `fragments/` and `render` places them; the viewer is the first UI component contribution of the default theme (`defaultThemeManifest`), registered as a built-in ahead of the declared plugins (`builtin` in the plugin loader dependencies) so that the registry lists it and no plugin claims its slot, and the site bundles the UI components a plugin contributes next to its own islands.
