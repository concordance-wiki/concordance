---
execution: human
triggers: [nouvelle locale demandée]
---
# Ajouter un pack de langue

Un mainteneur apprend une nouvelle locale à l'étape de reconnaissance.

## Étapes

1. Le [mainteneur](../roles/mainteneur.md) écrit le pack : mots vides, terminaisons du pluriel, repli des accents et préfixes de type.
2. Le dictionnaire est reconstruit sur un corpus de cette locale et les occurrences sont comparées à une liste revue.
   - Si un alias est manqué, aller à l'étape 1.
3. Le pack est enregistré sous son étiquette BCP 47.
4. Fin.
