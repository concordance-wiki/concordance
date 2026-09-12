---
execution: mixed
triggers: [termination request]
---
# Terminate a contract

A member asks to end a contract.

## Steps

1. The [account manager](../roles/account-manager.md) records the request on [termination request](../screens/termination-request.md).
   - If the request falls inside the cooling-off period, the [withdrawal refund](../rules/withdrawal-refund.rule.md) rule applies and go to step 3.
2. The [termination notice](../rules/termination-notice.rule.md) rule sets the end date.
3. The [nightly settlement](../batches/nightly-settlement.md) pays the refund when there is one.
4. End.
