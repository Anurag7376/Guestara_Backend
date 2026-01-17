**Project Overview**

This repository contains a small booking-and-pricing backend implemented with Node.js, Express and MongoDB. The code is organized to separate HTTP routing, domain modules, data models and utilities so the pricing/booking logic can be tested independently from network and persistence layers.

**Architecture**

- **`src/app.js`**: Express application setup and global middleware.
- **`src/server.js`**: Server bootstrap and DB connection.
- **`src/config`**: Configuration helpers (DB, booking limits etc.).
- **`src/routes`**: Top-level routes that compose module routes.
- **`src/modules`**: Domain modules (for example `item` and `booking`) containing module-specific routes, controllers and services. This keeps domain code grouped and easier to test.
- **`src/controllers`**: Controller adapters used by some route variants.
- **`src/models`**: Mongoose model definitions (Item, Category, Subcategory, Addon, AddonGroup, Booking).
- **`src/utils`**: Reusable helpers (time parsing, slot generation, date utilities, pricing helpers).
- **`src/middlewares`**: Express middlewares (error handling, etc.).

The project intentionally separates:

- HTTP layer (routes/controllers)
- Business logic (services in `src/modules/*/*.js`)
- Persistence models (`src/models`) and utilities (`src/utils`)

This structure allows unit testing the pricing and booking services without spinning up Express or MongoDB.

**Data Modeling Decisions**

- `Item` model: stores `pricing` as an object `{ type, config }` so the pricing engine can switch behavior by `type`. `parentType` indicates whether the item belongs directly to a `Category` or a `Subcategory`.
- `Category` and `Subcategory` models: contain canonical tax settings (`tax_applicable` and `tax_percentage`) and `is_active` flags for soft-delete behavior.
- `Addon` and `AddonGroup`: addons are linked to `itemId`. `AddonGroup` encodes selection rules (`minSelect`, `maxSelect`, `selectionType`) which are validated when summing addon prices.
- `Booking`: stores `startDateTime`, `endDateTime`, `dateKey`, `status`, `addonsSelected`, and an `invoiceSnapshot` (pricing snapshot captured at booking/reschedule time). Storing a snapshot makes invoices stable even if pricing or taxes change later.
- Indexes: models include indices for efficient querying of active bookings, recent items and price lookups.

These decisions prioritize clarity and auditability (invoice snapshots) over normalizing everything into separate price tables.

**Tax Inheritance Implementation**

Tax selection follows this deterministic order:

- If `item.tax_applicable` is non-null, the item explicitly overrides tax behavior. If true, use `item.tax_percentage`; if false, tax is not applied.
- Else if the item belongs to a `Subcategory` and `subcategory.tax_applicable` is non-null, use the subcategory setting.
- Else use the parent `Category` tax settings.

This logic is implemented in `resolveEffectiveTax(...)` (used by pricing/booking flows) and ensures any explicit override at the item or subcategory level takes precedence over category defaults. When `tax_applicable` is false, the stored `tax_percentage` is normalized to `null` during validation to avoid ambiguity.

**Pricing Engine (how it works)**

The pricing engine is a small, deterministic function that accepts: `{ item, usage, time }` and returns `{ basePrice, discount, appliedRule }`.

Supported pricing types:

- **STATIC**: fixed `config.price`.
- **COMPLIMENTARY**: price zero.
- **DISCOUNTED**: base price plus a discount. Supports `FLAT` and `PERCENT` discounts; output includes computed discount `amount`.
- **TIERED**: `config.tiers` is an array of `{ upto, price }`. `usage` is required to select the appropriate tier.
- **DYNAMIC_TIME**: pricing windows (`config.windows`) with `{ start, end, price }`. A `time` query param selects the appropriate window; `unavailableOutside` controls whether times outside windows are allowed.

The engine performs input validation (required params per pricing type) and returns a normalized `appliedRule` object describing why the returned base price was chosen. The final payable amount is calculated by the service layer (which applies addons and tax on top of base price and discount). This keeps the engine focused on base price & discount resolution only.

**How addons & tax are applied**

Addons: `validateAndSumAddons` fetches selected addons, verifies they belong to the item and validates group selection rules before summing prices.

Tax: after subtotal (basePrice - discount + addonsTotal), the `effectiveTax` from tax inheritance is applied: `taxAmount = subtotal * (percentage / 100)` when `applicable` is true.

**Tradeoffs and Simplifications**

- Authentication/Authorization: minimal or no auth flows are implemented. Calls that would require an authenticated `customerId` accept `null` and skip per-user limits.
- Timezones: availability uses a `timezone` string but the implementation assumes local server time for simplicity. Robust timezone handling (IANA conversions, DST) was deferred to reduce complexity.
- Concurrency and locking: booking conflict checks use DB queries and optional transactions for reschedule, but high-load race conditions and queuing were not implemented.
- Pricing complexity: no stacking of multiple complex discounts or coupons; the engine uses a single applied rule model for clarity.
- Tests: light, focused runtime checks were added (`test-runner.mjs`) for pure utilities and the pricing engine. Full integration tests require a MongoDB instance and were left as next steps.

These tradeoffs were made to keep the codebase small and maintainable while focusing on correctness of core pricing and booking flows.

**Run locally**

Prerequisites: Node.js >= 18, npm, and a MongoDB instance (URI). Create a `.env` in `backend` with at least:

```bash
MONGO_URI="mongodb://localhost:27017/guestara"
PORT=5000
```

Install dependencies and run in development mode:

```bash
cd backend
npm install
npm run dev
```

Quick tests for utilities/pricing (no DB required):

```bash
node test-runner.mjs
```

Key API endpoints (mounted under `/api`):

- **Item pricing**: GET `/api/items/:id/price?time=HH:mm&usage=NUM&addons=ID1,ID2`
- **Available slots**: GET `/api/items/:id/available-slots?date=YYYY-MM-DD`
- **Book a slot**: POST `/api/items/:id/book` (JSON body with `date,startTime,endTime,customerName,customerPhone`)
- **Cancel booking**: PATCH `/api/bookings/:id/cancel`
- **Reschedule booking**: PATCH `/api/bookings/:id/reschedule` (JSON body with `date,startTime,endTime,addonsSelected,usage`)

If you want automated tests that exercise the full HTTP API without an external MongoDB, I can add `mongodb-memory-server` and a small test harness; tell me if you'd like that and I will add it.

**Files to inspect for core logic**

- `src/modules/item/pricing/pricing.engine.js` — pricing decision logic
- `src/modules/item/item.price.service.js` — combines pricing, addons and tax
- `src/modules/booking/bookingService.js` — booking, reschedule, conflict checks

---
