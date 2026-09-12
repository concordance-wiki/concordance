---
"@concordance-wiki/plugin-contract-wsdl": minor
"@concordance-wiki/plugin-contract-openapi": minor
"@concordance-wiki/core": minor
"@concordance-wiki/checks": minor
"@concordance-wiki/profile": minor
---

Add the `contract-wsdl` plugin: the WSDL 1.1 or 2.0 contract an `api` note declares through its `contract` attribute produces one `endpoint` entity per port type or interface operation, titled `operation (port)`, with its port, binding, SOAP action and documentation, one `exposes` link per operation at the `contract_import` confidence with the contract location and the operation name as provenance, the XSD elements and complex types its messages reference as candidate objects (inline schemas walked, imported names kept by name), and a contract record; an imported WSDL and an imported OpenAPI produce entities of the same shape. The loading shared by the contract plugins moves to the core (`loadContracts` with a `ContractReader`, the contract cache, `declaredContracts`, `xmlRootOf`); each plugin decides on content whether a contract is its business, so that an XML contract is left to the WSDL plugin and anything else to the OpenAPI plugin; the `W-CONTRACT-UNREACHABLE` remediation no longer names one format. Endpoints from both plugins carry a `style` attribute (`http` or `soap`); the default profile declares `style`, `port`, `binding` and `soap_action` on the `endpoint` type.
