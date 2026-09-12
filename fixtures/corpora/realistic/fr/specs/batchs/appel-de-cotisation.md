---
schedule: "0 5 1 * *"
window: 05:00-06:00
depends_on: [batchs/reglement-nocturne]
---
# Appel de cotisation

Appelle les cotisations dues pour le mois, envoie les avis de renouvellement et remet les prélèvements à la banque. Tourne après le [règlement nocturne](reglement-nocturne.md).

## Lit

- [Cotisation](../objets/cotisation.md)
- [Table CONTRAT](../tables/contrat.table.md)

## Écrit

- [Cotisation](../objets/cotisation.md)
