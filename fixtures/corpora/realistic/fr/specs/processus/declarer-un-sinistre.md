---
execution: mixed
triggers: [sinistre signalé par l'adhérent]
---
# Déclarer un sinistre

Un adhérent signale un événement couvert par le contrat.

## Étapes

1. Le [gestionnaire](../roles/gestionnaire.md) enregistre la déclaration sur [saisie de déclaration de sinistre](../ecrans/saisie-declaration-de-sinistre.md).
   - Si le [délai de déclaration](../regles/delai-de-declaration-sinistre.regle.md) est dépassé, la déclaration est refusée sauf si le [responsable d'agence](../roles/responsable-d-agence.md) lève le délai.
2. L'[API Sinistres](../api/sinistres.md) ouvre le dossier sinistre.
3. Le [gestionnaire sinistres](../roles/gestionnaire-sinistres.md) instruit le dossier sur [instruction du sinistre](../ecrans/instruction-sinistre.md) et mandate un expert.
4. L'indemnité est approuvée et payée comme un versement sur le contrat.
5. Fin.
