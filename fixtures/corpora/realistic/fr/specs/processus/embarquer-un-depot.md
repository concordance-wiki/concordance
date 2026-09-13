---
execution: mixed
triggers: [dépôt déclaré]
---
# Embarquer un dépôt

Une équipe ajoute son dépôt au corpus.

## Étapes

1. Le [mainteneur](../roles/mainteneur.md) déclare la source dans la configuration et la valide.
2. Le premier build clone le dépôt à la profondeur 1 sur la référence déclarée et lit chaque ressource.
   - Si une note casse le [motif d'identifiant](../regles/motif-d-identifiant.regle.md), le build s'arrête et aller à l'étape 1.
3. L'[auteur](../roles/auteur.md) revoit les pages d'entité de la nouvelle source.
4. Fin.
