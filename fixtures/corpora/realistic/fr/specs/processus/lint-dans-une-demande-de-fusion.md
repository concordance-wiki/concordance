---
execution: service
triggers: [demande de fusion ouverte ou mise à jour]
---
# Lint dans une demande de fusion

Une forge contrôle les notes qu'une demande de fusion modifie.

## Étapes

1. La forge exécute le linter sur les fichiers modifiés.
   - Si la [politique fail-on](../regles/politique-fail-on.regle.md) est atteinte, le pipeline échoue et aller à l'étape 4.
2. Le rapport de forge est publié sur la demande de fusion.
3. L'[auteur](../roles/auteur.md) corrige les constats et le [responsable qualité](../roles/responsable-qualite.md) acquitte le reste.
4. Fin.
