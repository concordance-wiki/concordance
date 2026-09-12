---
execution: mixed
---
# Record a payment

## Steps

1. The [account manager](../roles/account-manager.md) finds the member on [member search](../screens/member-search.md).
2. The account manager enters the amount on [free payment entry](../screens/free-payment-entry.md).
   - If the [annual cap](../rules/annual-cap.rule.md) is exceeded, go to step 4.
3. The [Payments API](../api/payments.md) creates the payment.
4. End.
