# Pure Tide order attribution SDK

Vendored from the agency-provided `@puretide/order-attribution` v1.0.0 developer package.

Only the protocol and integration core are included. The package's Node 24 `node:sqlite` reference repository is intentionally omitted; `lib/ordersDb.ts` implements the same durable repository contract using the store's existing persistent `sql.js` order database and Node 22 runtime.

The merchant adapter adds `recordVerifiedPaid()` for payment flows that have already completed their existing provider signature, account, order, amount, currency, and settlement validation before updating the authoritative order to `paid`.
