---
application: gestion-contrats
date: 2026-06-10
---
# Étude d'éligibilité sinistres

Dimensionne le contrôle du délai de carence à la déclaration. Aujourd'hui le délai de carence est lu dans les conditions particulières par le gestionnaire sinistres ; demain l'[API Sinistres](../specs/api/sinistres.md) le lit sur la garantie et refuse un sinistre déclaré pendant le délai de carence.

Le changement touche [saisie de déclaration de sinistre](../specs/ecrans/saisie-declaration-de-sinistre.md), la règle de [délai de déclaration du sinistre](../specs/regles/delai-de-declaration-sinistre.regle.md) et le [suivi du sinistre](../specs/ecrans/portail/suivi-sinistre.md) du portail.
