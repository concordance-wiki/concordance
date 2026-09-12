---
type: rule
severity: blocking
condition: total payments over the calendar year exceed the contract cap
---
# Annual cap

The total of payments on a contract over a calendar year may not exceed the cap set at subscription. The check happens in the [Payments API](api.md) only; screens display the message it returns and never recompute the cap, as recorded in the [cap checked server-side](decision.md) decision.

## Applies to

- [Free payment entry](screen.md)
- [Payments API](api.md)
- [Payment](business_object.md)
