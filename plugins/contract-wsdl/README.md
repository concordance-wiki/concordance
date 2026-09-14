<p align="center">
  <img src="https://raw.githubusercontent.com/concordance-wiki/concordance/main/brand/concordance-mark.svg" width="72" alt="Concordance">
</p>

<h1 align="center">@concordance-wiki/plugin-contract-wsdl</h1>

<p align="center"><strong>Reads the WSDL contract an API note declares, so your SOAP services are inventoried like your HTTP APIs.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@concordance-wiki/plugin-contract-wsdl"><img alt="npm" src="https://img.shields.io/npm/v/@concordance-wiki/plugin-contract-wsdl?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/badge/licence-GPL--3.0--or--later-16181B?style=flat-square"></a>
  <a href="https://github.com/concordance-wiki/concordance/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/concordance-wiki/concordance/ci.yml?branch=main&label=ci&style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/getting-started.md">Getting started</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/configuration.md">Configuration</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md">Writing notes</a> ·
  <a href="https://github.com/concordance-wiki/concordance/blob/main/plugins/contract-wsdl/CHANGELOG.md">Changelog</a>
</p>

---

## Why

The inventory of an organisation does not stop at the modern perimeter: the services that run the business are often SOAP, and their contract is the only document that still tells the truth about them. This plugin imports the WSDL 1.1 or 2.0 contract an `api` note declares, from a URL or a path, and the wiki shows the service as the contract describes it: one page per operation of every port type, linked to the API with evidence, the XSD elements and types as candidate business objects, and the contract in a viewer on the page of the API. Install it next to [`@concordance-wiki/cli`](https://www.npmjs.com/package/@concordance-wiki/cli); it is not part of [`@concordance-wiki/concordance`](https://www.npmjs.com/package/@concordance-wiki/concordance). No system dependency.

## Quick start

```bash
npm install --save-dev @concordance-wiki/plugin-contract-wsdl
```

Then declare it in `concordance.yaml`:

```yaml
plugins:
  - "@concordance-wiki/plugin-contract-wsdl"
```

An `api` note names its contract, as a URL or as a path relative to the note:

```markdown
---
type: api
protocol: soap
contract: https://legacy.example.invalid/forge-bridge?wsdl
---

# Forge bridge
```

## What you get

- **One `endpoint` page per operation** of every port type, titled `operation (port)`, produced by the build from the contract.
- **Links with evidence**: an `exposes` link from the API to each operation at confidence 0.95.
- **Business objects surfaced**: the XSD elements and types the messages reference become candidate objects of the wiki.
- **The contract on the page**: the page of the API shows the contract viewer.
- **Both WSDL versions**: `readWsdl` reads WSDL 1.1 and 2.0; `isWsdlRoot` tells a WSDL from any other XML.
- **Side by side with OpenAPI**: with the OpenAPI plugin declared too, an XML document whose root is `definitions` or `description` goes here, anything else to the OpenAPI plugin.
- **A build that goes on**: a contract that cannot be fetched, read or parsed is a `W-CONTRACT-UNREACHABLE` finding, not a failure.

## Documentation

- [Writing notes](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/writing-notes.md), an API note declares its contract, and operation notes
- [Plugins](https://github.com/concordance-wiki/concordance/blob/main/docs/guides/plugins.md), declaring a plugin
- [W-CONTRACT-UNREACHABLE](https://github.com/concordance-wiki/concordance/blob/main/docs/checks/W-CONTRACT-UNREACHABLE.md)
- [Home page](https://concordance-wiki.github.io/concordance/), the [demo wiki](https://concordance-wiki.github.io/demo-wiki/) and the [changelog](https://github.com/concordance-wiki/concordance/blob/main/plugins/contract-wsdl/CHANGELOG.md)

Part of [Concordance](https://github.com/concordance-wiki/concordance), GNU GPL v3 or later.

<details>
<summary>Inside the package</summary>

### Contribution

One `source` of kind `wsdl`, with no system dependency. For every `api` entity whose `contract` attribute names a WSDL document, as a URL or as a path relative to the note, the source produces:

- one `endpoint` entity per operation of every port type (WSDL 1.1) or interface (WSDL 2.0), identified as `<api id>/<operation name>` slugified, titled `operation (port)`, with `type_origin: contract` and the attributes `operation_id`, `port`, `binding`, `soap_action`, `summary` and `style: soap`; the operation name is an alias, so that a note that names it is recognised;
- one `exposes` link from the API to each endpoint, at the `contract_import` confidence of the profile (0.95), with a provenance that carries the contract location and the operation name;
- one candidate object per XSD element or complex type the operations' messages reference, offered under `candidates.objects` without being linked to anything: the author decides which ones deserve a note;
- one contract record with the title the contract declares (its `documentation`, or its `name`), an empty version since a WSDL declares none, the fingerprint of its bytes and the import date from the injected clock.

Port types and their operations are sorted by name, so that two builds on the same contract give the same entities in the same order. Two operations whose names slugify alike, in two port types for instance, get numbered identifiers (`cancelorder`, `cancelorder-2`).

An endpoint imported from a WSDL has the same shape as one imported from an OpenAPI contract: the same entity keys, `type_origin`, link and provenance shape; the attributes carry `operation_id`, `summary` and `style` in both cases, then `port`, `binding` and `soap_action` for SOAP where HTTP carries `method`, `path` and `tags`. The rest of the chain does not know the difference.

### Behaviour

- The loading is the one `@concordance-wiki/core` shares between the contract plugins (`loadContracts`): a `http://` or `https://` location is fetched through the `fetch` of the plugin context, any other location is a path resolved from the folder of the API note inside its source; the extracted contract is cached under `<cache>/contracts/<sha256 of the text>.json`; a contract that cannot be fetched, read or parsed yields a `W-CONTRACT-UNREACHABLE` finding naming the reason and the other contracts are still imported.
- The plugin decides on content, not on extension, whether a contract is its business: an XML document whose root element is `definitions` (WSDL 1.1) or `description` (WSDL 2.0), whatever the prefix, is read; anything else is left to the OpenAPI plugin, which in turn leaves every XML document alone. A WSDL served as `service?wsdl` or saved as `.xml` is read; a well-formed XML document whose root is neither, an XSD for instance, is accepted by no plugin: nothing is imported and nothing is reported for it.
- Malformed XML is a finding naming the parser's reason and the line. `readWsdl`, called directly, also refuses a well-formed document whose root is neither `definitions` nor `description`.

### What is read, and what is not

WSDL 1.1 is read in full for what the entity carries: the operations of every `portType`, their `documentation` (whitespace collapsed, absent when empty) as summary, the `binding` whose `type` names the port type and the first `service/port` (by service name, then port name) whose `binding` names it as `port` and `binding`, and the `soapAction` of the `soap:operation` (SOAP 1.1 or 1.2) of the bound operation, absent when empty. Namespace prefixes are ignored on element and attribute names and stripped from the values that reference a name (`tns:BuildReport` is `BuildReport`).

WSDL 2.0 is read for its `interface` operations: their names and `documentation`, the `element` of their `input` and `output` (`#none` and `#any` skipped), and, when the document declares them, the `binding` whose `interface` names the interface, the first `service/endpoint` bound to it and the `wsoap:action` of the bound operation. Message exchange patterns, HTTP bindings and features are not read.

For the contract viewer of the API page, each operation also carries what it exchanges: the element of its input message, or its parts as `name: type` when it has several, as the request; its output message and its faults as responses; and the inline elements and complex types the operations reference are described as schemas, with their `annotation/documentation`, their named type and their fields (every `element` and `attribute` below the definition, the fields of an `extension` or `restriction` base first, `minOccurs="0"` and `use="required"` deciding the requirement). Nothing of it reaches the entities.

Candidate objects come from the messages of each operation: in 1.1 the `element` or `type` of every `part` of its `input`, `output` and `fault` messages; in 2.0 the `element` of its `input` and `output`. A referenced name declared by an inline `types/schema` (`xsd:element` or `xsd:complexType`) is walked: the `type`, `ref` and `base` references of its definition are followed, transitively and once each, into the other elements and complex types the schema declares. A name that no inline schema declares, one that an `xsd:import` brings in for instance, is kept by name: the imported schemas are not fetched, and the built-in XML Schema types (`string`, `int`, `dateTime`, ...) are never candidates. A simple type reached through a definition is not a candidate; one a part names directly is kept like any referenced name.

The XML parser is `fast-xml-parser`, the one the office metadata reader already depends on, with namespace prefixes removed and the document validated before it is read; no other dependency is added.

### Testing

Unit tests read a WSDL 1.1 fixture with two port types, two bindings, several ports and an imported schema, a WSDL 2.0 fixture, malformed and non-WSDL XML; they run the source through the plugin registry with an in-memory file system, a fixed clock and a `fetch` double, and check the parity of shape with the OpenAPI plugin on the example contracts of the API note template, `docs/templates/openapi.example.json` and its WSDL twin `docs/templates/wsdl.example.wsdl` in the repository. No test touches the network.

</details>
