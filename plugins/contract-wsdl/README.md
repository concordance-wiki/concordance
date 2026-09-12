# @concordance-wiki/plugin-contract-wsdl

Imports the WSDL contract an `api` note declares, so that the operations of a SOAP service come from the contract like those of an HTTP API do, and the inventory does not stop at the modern perimeter.

## Contribution

One `source` of kind `wsdl`, with no system dependency. For every `api` entity whose `contract` attribute names a WSDL document, as a URL or as a path relative to the note, the source produces:

- one `endpoint` entity per operation of every port type (WSDL 1.1) or interface (WSDL 2.0), identified as `<api id>/<operation name>` slugified, titled `operation (port)`, with `type_origin: contract` and the attributes `operation_id`, `port`, `binding`, `soap_action`, `summary` and `style: soap`; the operation name is an alias, so that a note that names it is recognised;
- one `exposes` link from the API to each endpoint, at the `contract_import` confidence of the profile (0.95), with a provenance that carries the contract location and the operation name;
- one candidate object per XSD element or complex type the operations' messages reference, offered under `candidates.objects` without being linked to anything: the author decides which ones deserve a note;
- one contract record with the title the contract declares (its `documentation`, or its `name`), an empty version since a WSDL declares none, the fingerprint of its bytes and the import date from the injected clock.

Port types and their operations are sorted by name, so that two builds on the same contract give the same entities in the same order. Two operations whose names slugify alike, in two port types for instance, get numbered identifiers (`cancelorder`, `cancelorder-2`).

An endpoint imported from a WSDL has the same shape as one imported from an OpenAPI contract: the same entity keys, `type_origin`, link and provenance shape; the attributes carry `operation_id`, `summary` and `style` in both cases, then `port`, `binding` and `soap_action` for SOAP where HTTP carries `method`, `path` and `tags`. The rest of the chain does not know the difference.

## Behaviour

- The loading is the one `@concordance-wiki/core` shares between the contract plugins (`loadContracts`): a `http://` or `https://` location is fetched through the `fetch` of the plugin context, any other location is a path resolved from the folder of the API note inside its source; the extracted contract is cached under `<cache>/contracts/<sha256 of the text>.json`; a contract that cannot be fetched, read or parsed yields a [`W-CONTRACT-UNREACHABLE`](../../docs/checks/W-CONTRACT-UNREACHABLE.md) finding naming the reason and the other contracts are still imported.
- The plugin decides on content, not on extension, whether a contract is its business: an XML document whose root element is `definitions` (WSDL 1.1) or `description` (WSDL 2.0), whatever the prefix, is read; anything else is left to the OpenAPI plugin, which in turn leaves every XML document alone. A WSDL served as `service?wsdl` or saved as `.xml` is read; a well-formed XML document whose root is neither, an XSD for instance, is accepted by no plugin: nothing is imported and nothing is reported for it.
- Malformed XML is a finding naming the parser's reason and the line. `readWsdl`, called directly, also refuses a well-formed document whose root is neither `definitions` nor `description`.

## What is read, and what is not

WSDL 1.1 is read in full for what the entity carries: the operations of every `portType`, their `documentation` (whitespace collapsed, absent when empty) as summary, the `binding` whose `type` names the port type and the first `service/port` (by service name, then port name) whose `binding` names it as `port` and `binding`, and the `soapAction` of the `soap:operation` (SOAP 1.1 or 1.2) of the bound operation, absent when empty. Namespace prefixes are ignored on element and attribute names and stripped from the values that reference a name (`tns:BuildReport` is `BuildReport`).

WSDL 2.0 is read for its `interface` operations: their names and `documentation`, the `element` of their `input` and `output` (`#none` and `#any` skipped), and, when the document declares them, the `binding` whose `interface` names the interface, the first `service/endpoint` bound to it and the `wsoap:action` of the bound operation. Message exchange patterns, HTTP bindings and features are not read.

Candidate objects come from the messages of each operation: in 1.1 the `element` or `type` of every `part` of its `input`, `output` and `fault` messages; in 2.0 the `element` of its `input` and `output`. A referenced name declared by an inline `types/schema` (`xsd:element` or `xsd:complexType`) is walked: the `type`, `ref` and `base` references of its definition are followed, transitively and once each, into the other elements and complex types the schema declares. A name that no inline schema declares, one that an `xsd:import` brings in for instance, is kept by name: the imported schemas are not fetched, and the built-in XML Schema types (`string`, `int`, `dateTime`, ...) are never candidates. A simple type reached through a definition is not a candidate; one a part names directly is kept like any referenced name.

The XML parser is `fast-xml-parser`, the one the office metadata reader already depends on, with namespace prefixes removed and the document validated before it is read; no other dependency is added.

## Testing

Unit tests read a WSDL 1.1 fixture with two port types, two bindings, several ports and an imported schema, a WSDL 2.0 fixture, malformed and non-WSDL XML; they run the source through the plugin registry with an in-memory file system, a fixed clock and a `fetch` double, and check the parity of shape with the OpenAPI plugin on the [example OpenAPI contract](../../docs/templates/openapi.example.json) and its [WSDL twin](../../docs/templates/wsdl.example.wsdl). No test touches the network.
