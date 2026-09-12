---
execution: scheduled
triggers: [contract expiry]
---
# Renew a contract

A contract reaches its expiry.

## Steps

1. The [premium call](../batches/premium-call.md) batch sends the renewal notice under the [contract renewal notice](../rules/contract-renewal-notice.rule.md) rule.
2. The member gives notice or stays silent.
   - If notice is given, go to [terminate a contract](terminate-a-contract.md).
3. The contract is renewed with the new premium rate.
4. End.
