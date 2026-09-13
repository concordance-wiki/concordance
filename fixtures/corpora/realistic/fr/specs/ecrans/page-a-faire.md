---
roles: [roles/responsable-qualite]
reads: [objets/constat, objets/build]
writes: [objets/constat]
url_pattern: /a-faire
---
# Page à faire

Liste les constats du dernier build groupés par contrôle et sévérité ; le responsable qualité y acquitte un constat et l'auteur le corrige. Les lignes d'obsolescence viennent du batch [rapport d'obsolescence](../batchs/rapport-d-obsolescence.md).

## Objets

- Lit : [constat](../objets/constat.md), [build](../objets/build.md)
- Écrit : [constat](../objets/constat.md)

## Actions

1. Ouvrir l'entité → [page d'entité](page-entite.md)
2. Retour → [page d'accueil](page-d-accueil.md)

## Règles

- [Politique fail-on](../regles/politique-fail-on.regle.md)
- [Obsolète après 180 jours](../regles/obsolete-apres-180-jours.regle.md)
