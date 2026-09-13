---
method: POST
path: /notifyBuild
api: api/forge-bridge
operation_id: notifyBuild
---
# Notify a build

Tells the bridge that a forge pipeline finished a lint and hands it the [build](../objects/build.md) identifier. Refuses a build that failed under the fail-on policy.

## Rules

- [Fail-on policy](../rules/fail-on-policy.rule.md)
