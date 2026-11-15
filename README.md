# Pizza Restaurant Internal Inventory Management Web Application

**A practical, auditable stockroom workspace for pizza restaurant teams.**

## Project overview

This full-stack internal web application gives restaurant managers and kitchen staff a shared view of ingredients and supplies. Staff can maintain an inventory catalogue, record every stock movement, spot items at or below their minimum level, and review or print the current stock report.

The application is implemented with **Node.js, Express, React, Vite, and SQLite**. The UI uses hand-authored responsive CSS. It does **not** currently use PostgreSQL or Tailwind CSS; documentation below reflects the code that is in this repository.

### Objectives

- Keep current stock and minimum levels visible to restaurant staff.
- Make stock-in, stock-out, and adjustment entries auditable.
- Prevent invalid or negative stock balances.
- Surface low-stock items before they disrupt service.
- Provide quick search/filter workflows and an exportable, printable snapshot.

## Features

- Staff sign-in and sign-out using bcrypt password hashes and an eight-hour JWT session cookie.
- Dashboard with active inventory count, low-stock count, and recent stock movement.
- Item creation, details, editing, soft deactivation, and reactivation.
- Optional supplier and notes fields.
- Search by item name, category, or supplier; filter by category and status; sort by name, category, or stock status.
- Stock-in, stock-out, and signed adjustments with an optional staff note.
- Guarded atomic stock updates: negative inventory is rejected and no partial transaction is saved.
- Per-item movement history with timestamp, movement type, signed quantity, note, and staff name.
- Low-stock route for active items whose quantity is less than or equal to the configured minimum.
- Current stock report with browser print and CSV export.
- Responsive layouts for desktop, tablet, and narrow/mobile screens.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, React Router, Vite, Lucide icons, custom CSS |
| Backend | Node.js ES modules, Express 4 |
| Database | SQLite via `better-sqlite3`; schema is initialized by the application |
| Authentication | `bcryptjs` password hashing, `jsonwebtoken`, HTTP-only cookie sessions |
| Request validation | Zod |
| Security middleware | Helmet, Express rate limiting, cookie-parser |
| Tests | Node.js built-in test runner and `fetch`-based API integration tests |

There is no standalone database service to install. SQLite is the project's current database; a PostgreSQL deployment would require a separate database/driver and schema migration that are not present here.

## Architecture

```text
React + Vite browser client
    │  /api requests, credentials included
    ▼
Express API
    ├── Helmet, JSON parsing, cookie parsing
    ├── Public health and authentication routes
    ├── JWT authentication middleware for inventory routes
    ├── Zod input validation
    └── better-sqlite3 transaction and query layer
             │
             ▼
         SQLite file
```

In development, Vite proxies `/api` requests to the Express API on port 4000. In production, the Express server serves `client/dist` and the API from the same origin.

## Database schema

The canonical schema and indexes are created on server startup in [`server/src/db.js`](./server/src/db.js). The following SQLite DDL summarizes the current schema; the application runs equivalent `CREATE TABLE IF NOT EXISTS` statements automatically.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('manager', 'staff')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE inventory_items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL,
  unit                 TEXT NOT NULL,
  quantity_available  REAL NOT NULL DEFAULT 0
                       CHECK (quantity_available >= 0),
  minimum_stock_level REAL NOT NULL DEFAULT 0
                       CHECK (minimum_stock_level >= 0),
  supplier             TEXT,
  notes                TEXT,
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stock_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id         INTEGER NOT NULL REFERENCES inventory_items(id),
  type            TEXT NOT NULL
                  CHECK (type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
  quantity_changed REAL NOT NULL CHECK (quantity_changed != 0),
  recorded_by     INTEGER NOT NULL REFERENCES users(id),
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_active_name
  ON inventory_items(active, name);
CREATE INDEX idx_transactions_item_created
  ON stock_transactions(item_id, created_at DESC);
CREATE INDEX idx_transactions_created
  ON stock_transactions(created_at DESC);
```

### Field and relationship reference

| Table | Field | Description |
| --- | --- | --- |
| `users` | `id` | Primary key for a staff account. |
|  | `name` | Display name shown in activity and history. |
|  | `email` | Unique, case-insensitive sign-in address. |
|  | `password_hash` | bcrypt hash; plaintext passwords are not stored. |
|  | `role` | `manager` or `staff`; current API stores this role but does not apply role-specific route authorization. |
|  | `created_at` | Account creation time in SQLite UTC datetime format. |
| `inventory_items` | `id` | Primary key for an inventory item. |
|  | `name`, `category`, `unit` | Item identity and the unit used for quantities. |
|  | `quantity_available` | Current on-hand amount; database check prevents values below zero. |
|  | `minimum_stock_level` | Replenishment threshold; low stock means quantity is at or below this value. |
|  | `supplier`, `notes` | Nullable supplier and storage/specification information. |
|  | `active` | Integer boolean used for soft deactivation; inactive items remain in history. |
|  | `created_at`, `updated_at` | Creation and latest item update times. |
| `stock_transactions` | `id` | Primary key for an immutable movement record. |
|  | `item_id` | Required foreign key to `inventory_items.id`. |
|  | `type` | `STOCK_IN`, `STOCK_OUT`, or `ADJUSTMENT`. |
|  | `quantity_changed` | Signed quantity delta applied to stock. Stock-out deltas are negative. |
|  | `recorded_by` | Required foreign key to `users.id`. |
|  | `remarks` | Nullable staff explanation or note. |
|  | `created_at` | Movement timestamp. |

`stock_transactions.item_id` references an inventory item and `recorded_by` references the staff account that submitted it. SQLite foreign-key enforcement is enabled by the server. Inventory is deactivated rather than deleted, preserving movement history.

### Setup and useful SQL

Schema initialization is automatic when the API starts. For a read-only check in SQLite:

```sql
PRAGMA foreign_key_check;

SELECT id, name, category, quantity_available, unit, minimum_stock_level, active
FROM inventory_items
ORDER BY name COLLATE NOCASE;

SELECT i.name, i.quantity_available, i.unit, i.minimum_stock_level
FROM inventory_items AS i
WHERE i.active = 1
  AND i.quantity_available <= i.minimum_stock_level
ORDER BY (i.minimum_stock_level - i.quantity_available) DESC, i.name;
```

To initialize and populate a fresh local database, use `npm run seed` (see installation below). The seed is idempotent for existing user accounts and only inserts sample inventory when the inventory table is empty. The manager password is refreshed each time the seed command runs; set the environment variables before using it.

## Prerequisites and installation

- Node.js **20.19+** or **22.12+** (Node 22 is the documented tested runtime).
- npm 10 or later.
- No PostgreSQL server or external service is required.

From the project root:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env`. Use a unique random `JWT_SECRET` of at least 32 characters and replace the sample manager/staff passwords with private passwords of at least 12 characters:

```dotenv
NODE_ENV=development
PORT=4000
JWT_SECRET=replace-with-a-unique-random-secret-of-at-least-32-characters
DATABASE_PATH=./server/data/inventory.sqlite
SEED_ADMIN_EMAIL=admin@pizzashop.local
SEED_ADMIN_PASSWORD=replace-with-a-private-password
SEED_STAFF_PASSWORD=replace-with-a-private-password
```

`SEED_STAFF_PASSWORD` is optional and defaults in the seed script if not set. Override the default before seeding. `.env` is ignored by Git; `.env.example` is retained as a template.

Create the schema and sample accounts/stock:

```powershell
npm run seed
```

Run API and web development servers together:

```powershell
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The API listens at `http://localhost:4000`; Vite proxies `/api` to it. Seeded manager email defaults to `admin@pizzashop.local`. The staff email is `staff@pizzashop.local`. Their passwords are whatever values were configured at seed time.

### Production build and start

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

The production server serves the built frontend and API on the configured port. Production cookies are marked `Secure`; deploy behind HTTPS. Keep secrets and the SQLite database private, maintain backups, and do not use sample credentials in a live deployment.

## Sample seed records

`npm run seed` creates ten inventory examples. These quantities and minimums are written in [`server/src/seed.js`](./server/src/seed.js):

| Item | Category | On hand | Minimum | Seed status |
| --- | --- | ---: | ---: | --- |
| Mozzarella Cheese | Cheese | 8.5 kg | 10 kg | Low |
| Pizza Dough Balls | Dough | 42 pcs | 30 pcs | Healthy |
| Pepperoni Slices | Toppings | 8.2 kg | 5 kg | Healthy |
| Marinara Sauce | Sauces | 6 liters | 4 liters | Healthy |
| 12-inch Pizza Boxes | Packaging | 18 pcs | 25 pcs | Low |
| Fresh Basil | Toppings | 12 bunches | 6 bunches | Healthy |
| Olive Oil | Sauces | 4.5 liters | 3 liters | Healthy |
| Sparkling Water | Beverages | 36 bottles | 24 bottles | Healthy |
| Parmesan Cheese | Cheese | 4.2 kg | 3 kg | Healthy |
| Gloves - Medium | Packaging | 7 boxes | 5 boxes | Healthy |

The sample Pepperoni and Pizza Box histories include stock-outs; the seed records matching opening amounts so each item's opening and movement deltas reconcile with its stored on-hand quantity.

## API routes and protection

All routes are mounted under `/api`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Health response. |
| `POST` | `/auth/login` | Public, rate-limited | Validates credentials, returns the user, and sets the session cookie. |
| `POST` | `/auth/logout` | Public | Clears the session cookie. |
| `GET` | `/auth/me` | Authenticated | Returns the current staff user. |
| `GET` | `/dashboard` | Authenticated | Active counts, low-stock items, and eight latest movements. |
| `GET` | `/items` | Authenticated | Search, filter, sort inventory and return categories. |
| `POST` | `/items` | Authenticated | Create an item and optionally record its opening quantity. |
| `GET` | `/items/:id` | Authenticated | Item details and movement history. |
| `PATCH` | `/items/:id` | Authenticated | Edit item details or active state; quantity changes are rejected here. |
| `DELETE` | `/items/:id` | Authenticated | Soft-deactivate an active item. |
| `POST` | `/items/:id/transactions` | Authenticated | Apply and record a stock movement. |

After the public health/authentication routes, `requireAuth` protects the remaining `/api` routes. It verifies the JWT, validates the user ID, and reloads the account from the database for each request. Request payloads are checked by Zod schemas. Login attempts are limited to 10 per 15-minute window.

### Stock update and audit behavior

The stock transaction endpoint translates a positive `STOCK_OUT` request into a negative delta. `STOCK_IN` and `ADJUSTMENT` use the submitted signed delta (stock-in/out inputs must be positive; adjustments may be signed). A synchronous `better-sqlite3` transaction:

1. Confirms the item exists and is active.
2. Updates quantity only when the resulting value remains at least zero.
3. Inserts the transaction record with the current staff ID and note.
4. Reads and returns the new item and transaction.

If the guarded update affects no row, the operation returns a conflict and the SQLite transaction rolls back. Item creation also inserts the item and, when nonzero, its opening stock record atomically.

## Main modules and workflows

- **Authentication:** Login validates email/password, compares the bcrypt hash, and writes an eight-hour JWT to an HTTP-only, SameSite Strict cookie. In production it is also Secure. Sign-out clears the cookie; invalid/expired sessions are sent back to login.
- **Dashboard:** Displays active item count, count at/below minimum, low-stock sample, and recent activity.
- **Inventory list:** Search is debounced in the client; category/status filters and sorting are sent to the API. Users can open an item, adjust stock, edit metadata, deactivate, or reactivate.
- **Item form:** Captures name, category, unit, current quantity for opening stock, minimum, and optional supplier/notes. Existing quantity is changed only through stock transactions.
- **Movement form:** Selects receive/use/adjustment, validates the amount server-side, and optionally stores staff remarks.
- **Item detail:** Shows current and minimum quantities, supplier/status, and reverse-chronological movement records.
- **Low-stock view:** Uses the same inventory interface filtered to active items with quantity less than or equal to minimum.
- **Reporting:** Displays active stock and status, uses `window.print()` for a printable view, and exports CSV. CSV values beginning with formula-significant characters are prefixed to reduce spreadsheet formula execution risk.
- **Seed data:** Adds manager/staff accounts and sample items. The sample inventory includes two intentionally low items and representative movements.

## Requirements completion audit

This audit is based on the implementation in `server/src`, `client/src`, and the integration tests in `server/test/inventory.test.js`.

| Requirement | Finding | Evidence / qualification |
| --- | --- | --- |
| Sign-in/sign-out, password hashing, JWT | **Implemented** | bcrypt hashes, JWT verification/signing, expiring HTTP-only cookie, logout clear, login rate limit. |
| Dashboard counts and recent activity | **Implemented** | Active-item count, at/below-minimum count, latest eight movement entries. No valuation metric exists because the schema has no unit-cost field. |
| Add/view/edit/deactivate items | **Implemented** | Optional supplier/notes; active flag supports deactivation/reactivation. |
| Stock transactions and atomic updates | **Implemented** | Stock-in/out/adjustments, guarded nonnegative update and movement insert in one SQLite transaction. Integration test verifies rollback after rejected stock-out. |
| Low-stock alert | **Implemented** | Active item is low when `quantity_available <= minimum_stock_level`; shown on dashboard and dedicated route. |
| Search, filter, sort | **Implemented** | Search by name/category/supplier; category/status filters; name/category/stock sorting. |
| Item transaction history | **Implemented** | Date, type, signed delta, staff name, and remarks are returned and displayed. |
| Reports and printable view | **Implemented** | Current active inventory, low-stock status, browser print, CSV export. |
| Responsive desktop/tablet UI | **Implemented** | CSS layout breakpoints cover wide, medium, tablet/mobile, and narrow screens. |

### Audit notes and boundaries

- The application has manager/staff roles stored on users, but no role-specific authorization policy; all authenticated users can call the same inventory management routes.
- The dashboard/API do not calculate stock valuation because no unit price or cost field exists.
- Stock alerts are in-app counts/lists; no email, SMS, or push notification service is configured.
- The seed fixture was audited so its sample opening quantities and stock-outs reconcile with stored inventory.

## Validation and tests

Run the API integration tests:

```powershell
npm test
```

Build the production frontend:

```powershell
npm run build
```

The current tests verify authentication protection, search/category filtering, stock transaction updates and rollback when stock would become negative, and rejection of invalid item data.

## Repository layout

```text
client/
  src/App.jsx          React routes, screens, forms, and API interactions
  src/api.js           Fetch helper and quantity/date formatting
  src/styles.css       Responsive, print, and UI styles
server/
  src/app.js           Express routes and middleware
  src/auth.js          JWT cookie and authentication middleware
  src/db.js            SQLite database connection, schema, and indexes
  src/seed.js          Manager/staff accounts and example records
  src/validation.js    Zod request schemas
  test/                API integration tests
.env.example           Local environment template
```
