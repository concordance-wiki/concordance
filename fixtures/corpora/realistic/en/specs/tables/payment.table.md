---
business_object: objects/payment
fields: [PAYMENT_ID, CONTRACT_ID, AMOUNT, VALUE_DATE, STATUS, KIND]
---
# PAYMENT table

One row per payment, free or scheduled, refunds included with a negative amount. Written by the nightly settlement and read by the [Payments API](../api/payments.md).
