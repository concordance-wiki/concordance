---
protocol: soap
exposure: internal
version: "1"
contract: contrats/sinistres.wsdl
consumers: [ecrans/instruction-sinistre]
---
# API Sinistres

Ouvre les dossiers sinistre et renvoie leur état. Un service SOAP historique décrit par son [contrat](contrats/sinistres.wsdl) ; l'écran d'instruction du sinistre est déclaré consommateur alors qu'il travaille directement sur le dossier sinistre, ce que le contrôle de désaccord des consommateurs signale.

## Consommateurs

- [Saisie de déclaration de sinistre](../ecrans/saisie-declaration-de-sinistre.md)
- [Suivi du sinistre](../ecrans/portail/suivi-sinistre.md)
- [Déclarer un sinistre](../processus/declarer-un-sinistre.md)

## Objets

- [Sinistre](../objets/sinistre.md)
- [Indemnité](../objets/indemnite.md)
