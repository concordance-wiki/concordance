---
roles: []
reads: [objets/suggestion, objets/candidat]
writes: [objets/suggestion, objets/candidat]
url_pattern: /service/suggestions
---
# Revue des suggestions

Où un mainteneur accepte ou écarte les suggestions que le service rédige : un candidat à définir, un lien à promouvoir, une note obsolète à revisiter. Travaille directement sur le fichier lock et le réécrit.

## Objets

- Lit : [suggestion](../../objets/suggestion.md), [candidat](../../objets/candidat.md)
- Écrit : [suggestion](../../objets/suggestion.md), [candidat](../../objets/candidat.md)

## Actions

1. Retour → [visionneuse de document](visionneuse-de-document.md)

## Règles

- [Termes rejetés jamais proposés](../../regles/termes-rejetes-jamais-proposes.regle.md)
