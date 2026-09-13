---
roles: [roles/auteur, roles/mainteneur]
reads: [objets/entite, objets/lien, objets/voisinage]
url_pattern: /entites/:id
---
# Page d'entité

Affiche une entité avec ses attributs, ses liens groupés par relation, son voisinage et les passages qui la mentionnent. Le badge d'obsolescence vient du batch [rapport d'obsolescence](../batchs/rapport-d-obsolescence.md) ; la confiance de chaque lien est affichée telle que le modèle l'a écrite.

## Objets

- Lit : [entité](../objets/entite.md), [lien](../objets/lien.md), [voisinage](../objets/voisinage.md)

## Actions

1. Ouvrir les mentions → [panneau des mentions](panneau-des-mentions.md)
2. Ouvrir la carte → [carte du voisinage](carte-du-voisinage.md)
3. Retour → [résultats de recherche](resultats-de-recherche.md)

## Règles

- [Motif d'identifiant](../regles/motif-d-identifiant.regle.md)
- [Plafond de la relation liée](../regles/plafond-de-la-relation-liee.regle.md)

## Contrôles appliqués

| Règle | Sévérité | Effet à la validation |
|---|---|---|
| [Motif d'identifiant](../regles/motif-d-identifiant.regle.md) | bloquante | Le build s'arrête et le constat nomme le fichier |
| [Obsolète après 180 jours](../regles/obsolete-apres-180-jours.regle.md) | avertissement | Un badge sur la page et une ligne dans le rapport d'obsolescence |
| [Plafond de la relation liée](../regles/plafond-de-la-relation-liee.regle.md) | avertissement | La confiance affichée ne dépasse jamais 0,6 |

## Maquette d'origine

![Esquisse de la page d'entité : l'arborescence de l'espace, la fiche, le volet](../assets/esquisse-page-entite.svg)
