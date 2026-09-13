---
execution: mixed
triggers: [commit sur une source déclarée, lancement manuel]
---
# Pipeline de build

Un mainteneur ou le build nocturne transforme les sources en site.

## Étapes

1. Le [mainteneur](../roles/mainteneur.md) lance le build, qui valide la configuration.
   - Si la configuration est invalide, aller à l'étape 7.
2. Chaque source est clonée ou mise à jour et ses ressources sont lues.
3. Les notes sont analysées et typées ; les contrats sont importés.
4. Les occurrences sont balayées et les candidats comptés.
5. Les liens sont inférés, le fichier lock est appliqué et le fichier de l'[API Modèle canonique](../api/modele-canonique.md) est écrit.
   - Si la [politique fail-on](../regles/politique-fail-on.regle.md) est atteinte, aller à l'étape 7.
6. Le site est rendu et publié.
7. Fin.
