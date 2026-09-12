---
protocol: rest
exposure: apim
version: "2"
contract: contrats/versements.openapi.json
---
# API Versements

Enregistre et lit les versements d'un contrat. Le seul endroit qui contrôle le [plafond annuel](../regles/plafond-annuel.regle.md) et le [plafond mensuel](../regles/plafond-mensuel.regle.md), comme décidé dans [plafond contrôlé côté serveur](../../decisions/plafond-controle-cote-serveur.md). Le [contrat](contrats/versements.openapi.json) liste trois opérations.

## Consommateurs

- [Saisie de versement libre](../ecrans/saisie-versement-libre.md)
- [Paiement en ligne](../ecrans/portail/paiement-en-ligne.md)
- [Règlement nocturne](../batchs/reglement-nocturne.md)
- [Enregistrer un versement](../processus/enregistrer-un-versement.md)

## Objets

- [Versement](../objets/versement.md)
- [Cotisation](../objets/cotisation.md)
