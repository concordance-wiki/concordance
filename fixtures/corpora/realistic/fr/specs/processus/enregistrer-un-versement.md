---
execution: mixed
triggers: [demande de versement]
---
# Enregistrer un versement

Un adhérent demande à verser un montant supplémentaire sur un contrat en cours.

## Étapes

1. Le [gestionnaire](../roles/gestionnaire.md) retrouve l'adhérent sur [recherche adhérent](../ecrans/recherche-adherent.md).
2. Le gestionnaire saisit le montant sur [saisie de versement libre](../ecrans/saisie-versement-libre.md).
   - Si le [plafond annuel](../regles/plafond-annuel.regle.md) ou le [plafond mensuel](../regles/plafond-mensuel.regle.md) est dépassé, aller à l'étape 5.
3. L'[API Versements](../api/versements.md) crée le versement.
4. Le [règlement nocturne](../batchs/reglement-nocturne.md) le règle et met à jour le solde.
5. Fin.
