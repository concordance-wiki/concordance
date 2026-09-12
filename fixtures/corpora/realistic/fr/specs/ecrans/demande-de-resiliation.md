---
roles: [roles/gestionnaire, roles/responsable-d-agence]
reads: [objets/contrat]
writes: [objets/contrat, objets/remboursement]
url_pattern: /contrats/:id/resilier
---
# Demande de résiliation

Enregistre une résiliation demandée par l'adhérent. Le préavis est calculé par la règle de [préavis de résiliation](../regles/preavis-de-resiliation.regle.md) ; lorsque la demande tombe dans le délai de rétractation, un remboursement est créé selon la règle de [remboursement sur renonciation](../regles/remboursement-sur-renonciation.regle.md).

## Objets

- Lit : [contrat](../objets/contrat.md)
- Écrit : [contrat](../objets/contrat.md), [remboursement](../objets/remboursement.md)

## Actions

1. Confirmer → [synthèse du contrat](synthese-contrat.md)
2. Annuler → [synthèse du contrat](synthese-contrat.md)

## Règles

- [Préavis de résiliation](../regles/preavis-de-resiliation.regle.md)
- [Remboursement sur renonciation](../regles/remboursement-sur-renonciation.regle.md)
