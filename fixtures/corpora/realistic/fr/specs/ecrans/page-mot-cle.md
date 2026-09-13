---
roles: [roles/mainteneur]
reads: [objets/page-mot-cle, objets/occurrence]
writes: [objets/candidat]
url_pattern: /mots-cles/:slug
---
# Page mot-clé

Permet à un mainteneur de revoir une page mot-clé : les passages d'une expression qui franchit le [seuil de publication](../regles/seuil-de-publication.regle.md) sans qu'aucune note ne la définisse. Les comptes viennent de l'[API Modèle canonique](../api/modele-canonique.md) ; la page les affiche et ne recompte jamais une occurrence.

Les expressions rejetées dans le fichier lock ne s'affichent pas ici : elles sont écartées avant l'écriture du modèle.

## Objets

- Lit : [page mot-clé](../objets/page-mot-cle.md), [occurrence](../objets/occurrence.md)
- Écrit : [candidat](../objets/candidat.md)

## Actions

1. Ouvrir une entité → [page d'entité](page-entite.md)
2. Rechercher → [résultats de recherche](resultats-de-recherche.md)

## Règles

- [Seuil de publication](../regles/seuil-de-publication.regle.md)
- [Identifiant de page mot-clé](../regles/identifiant-de-page-mot-cle.regle.md)
- [Termes rejetés jamais proposés](../regles/termes-rejetes-jamais-proposes.regle.md)
