---
execution: mixed
triggers: [payment request]
---
# Record a payment

A member asks to pay an extra amount on a running contract.

## Steps

1. The [account manager](../roles/account-manager.md) finds the member on [member search](../screens/member-search.md).
2. The account manager enters the amount on [free payment entry](../screens/free-payment-entry.md).
   - If the [annual cap](../rules/annual-cap.rule.md) or the [monthly cap](../rules/monthly-cap.rule.md) is exceeded, go to step 5.
3. The [Payments API](../api/payments.md) creates the payment.
4. The [nightly settlement](../batches/nightly-settlement.md) settles it and updates the balance.
5. End.
