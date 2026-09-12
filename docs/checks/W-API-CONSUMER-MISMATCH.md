# W-API-CONSUMER-MISMATCH

**Severity:** warning. **Family:** contracts.

An API declares a consumer that never cites it, or a note cites an API that does not list it.

The two sides disagree. One of them is out of date.

## Before

```
api/payments.md declares consumers: [screens/member-search]
screens/member-search.md never mentions the Payments API
```

## After

```
api/payments.md declares consumers: [screens/free-payment-entry]
screens/free-payment-entry.md: "calls the [Payments API](../api/payments.md)"
```

## How to fix

Reconcile the two notes: remove the stale consumer or add the missing mention.

Severity can be overridden in `concordance.yaml` or in a repository's `concordance-lint.yaml` under `checks:`.
