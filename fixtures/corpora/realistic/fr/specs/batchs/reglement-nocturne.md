---
schedule: "0 2 * * *"
window: 02:00-04:00
depends_on: []
---
# Règlement nocturne

Règle les versements de la journée, paie les remboursements, déclenche les échéances de versement programmé et recalcule le solde de chaque contrat. Appelle l'[API Versements](../api/versements.md) pour chaque échéance.

## Lit

- [Versement](../objets/versement.md)
- [Remboursement](../objets/remboursement.md)

## Écrit

- [Table VERSEMENT](../tables/versement.table.md)
- [Table CONTRAT](../tables/contrat.table.md)
