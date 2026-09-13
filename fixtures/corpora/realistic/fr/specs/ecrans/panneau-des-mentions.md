---
roles: [roles/auteur]
reads: [objets/entite, objets/lien, objets/occurrence]
url_pattern: /entites/:id/mentions
---
# Panneau des mentions

Où l'auteur voit chaque mention d'une entité : le fichier, la ligne, la méthode qui l'a trouvée et la confiance qu'elle a gagnée. Une occurrence dans un bloc de code n'est pas listée, puisque le balayage l'écarte.

## Objets

- Lit : [lien](../objets/lien.md), [occurrence](../objets/occurrence.md)

## Actions

1. Retour → [page d'entité](page-entite.md)

## Règles

- [Correspondance des titres de section](../regles/correspondance-des-titres-de-section.regle.md)
