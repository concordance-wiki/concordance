---
application: concordance-service
protocol: soap
exposure: internal
version: "0"
contract: contrats/pont-de-forge.wsdl
---
# API Pont de forge

Un pont vers les forges qui ne parlent que SOAP : la forge notifie un build et récupère ses constats, comme le décrit le [contrat](contrats/pont-de-forge.wsdl). Rien ne le consomme encore, comme consigné dans [pont de forge exposé](../../decisions/pont-de-forge-expose.md).

## Objets

- [Build](../objets/build.md)
- [Constat](../objets/constat.md)
