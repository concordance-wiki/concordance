---
execution: mixed
triggers: [demande de résiliation]
---
# Résilier un contrat

Un adhérent demande à mettre fin à un contrat.

## Étapes

1. Le [gestionnaire](../roles/gestionnaire.md) enregistre la demande sur [demande de résiliation](../ecrans/demande-de-resiliation.md).
   - Si la demande tombe dans le délai de rétractation, la règle de [remboursement sur renonciation](../regles/remboursement-sur-renonciation.regle.md) s'applique et aller à l'étape 3.
2. La règle de [préavis de résiliation](../regles/preavis-de-resiliation.regle.md) fixe la date de fin.
3. Le [règlement nocturne](../batchs/reglement-nocturne.md) paie le remboursement quand il y en a un.
4. Fin.
