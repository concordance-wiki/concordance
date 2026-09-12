---
type: business_object
attributes: [amount, value date, reason]
lifecycle: [entered, validated, settled, cancelled]
---
# Payment

An amount paid into a contract at a given value date. A payment is entered on a screen, validated against the [annual cap](rule.md), and settled by the [nightly settlement](batch.md). It is stored in the [PAYMENT table](data_object.md).
