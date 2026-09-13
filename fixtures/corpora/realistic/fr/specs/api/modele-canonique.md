---
protocol: rest
exposure: direct
version: "1"
---
# API Modèle canonique

Le fichier `model.json` que chaque build écrit : entités, liens, constats et pages mots-clés, lu par le site et par les exportateurs. Le seul endroit où le [seuil de publication](../regles/seuil-de-publication.regle.md) et le [plafond de la relation liée](../regles/plafond-de-la-relation-liee.regle.md) s'appliquent, comme décidé dans [seuil appliqué dans le modèle](../../decisions/seuil-applique-dans-le-modele.md). Pas de contrat : le fichier est le contrat.

## Consommateurs

- [Page d'accueil](../ecrans/page-d-accueil.md)
- [Page d'entité](../ecrans/page-entite.md)
- [Page mot-clé](../ecrans/page-mot-cle.md)
- [Rapport d'obsolescence](../batchs/rapport-d-obsolescence.md)
- [Pipeline de build](../processus/pipeline-de-build.md)

## Objets

- [Entité](../objets/entite.md)
- [Lien](../objets/lien.md)
- [Page mot-clé](../objets/page-mot-cle.md)
