---
type: process
execution: mixed
triggers: [payment request]
---
# Record a payment

A member asks to pay an extra amount on a running contract.

## Steps

1. The [account manager](role.md) finds the member.
2. The account manager enters the amount on [free payment entry](screen.md).
   - If the [annual cap](rule.md) is exceeded, go to step 5.
3. The system calls the [Payments API](api.md).
4. A [payment](business_object.md) is created on the contract.
5. End.
