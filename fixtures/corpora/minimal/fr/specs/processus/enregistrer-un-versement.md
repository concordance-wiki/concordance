---
execution: mixed
---
# Enregistrer un versement

## Étapes

1. Le [gestionnaire](../roles/gestionnaire.md) retrouve l'adhérent sur [recherche adhérent](../ecrans/recherche-adherent.md).
2. Le gestionnaire saisit le montant sur [saisie de versement libre](../ecrans/saisie-versement-libre.md).
   - Si le [plafond annuel](../regles/plafond-annuel.regle.md) est dépassé, aller à l'étape 4.
3. L'[API Versements](../api/versements.md) crée le versement.
4. Fin.
