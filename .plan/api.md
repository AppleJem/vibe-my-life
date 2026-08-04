# API Reference

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

## Auth Endpoints

### POST /api/auth/login

Login with credentials.

**Auth required**: No

**Request body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Success response** (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error response** (401):
```json
{
  "error": "Invalid credentials"
}
```

---

## Expense Endpoints

### GET /api/expenses

Get all expenses for a given month.

**Auth required**: Yes

**Query params**:
| Param | Type | Required | Example |
|-------|------|----------|---------|
| month | string | Yes | `2026-08` |

**Success response** (200):
```json
{
  "expenses": [
    {
      "id": "a1b2c3d4-...",
      "date": "2026-08-04",
      "amount": 42.50,
      "category": "food",
      "note": "Lunch at sushi place",
      "createdAt": "2026-08-04T12:00:00.000Z"
    }
  ]
}
```

---

### POST /api/expenses

Create a new expense.

**Auth required**: Yes

**Request body**:
```json
{
  "date": "2026-08-04",
  "amount": 42.50,
  "category": "food",
  "note": "Lunch at sushi place"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| date | string | Yes | Format: YYYY-MM-DD |
| amount | number | Yes | Must be positive. **Always in the base currency** |
| category | string | Yes | Category key |
| note | string | No | Defaults to "" |
| baseCurrency | string | No | 3-letter ISO code; snapshot of the base at save time |
| currency | string | No | 3-letter ISO code. Omit when the expense was entered in the base currency |
| originalAmount | number | No | The amount as typed, in `currency` |
| rate | number | No | Units of `currency` per 1 unit of base, at save time |

The three foreign fields travel together — send all of them or none. `currency` being
present is the signal that the expense was a foreign-currency spend.

**Success response** (201):
```json
{
  "expense": {
    "id": "a1b2c3d4-...",
    "date": "2026-08-04",
    "amount": 12.25,
    "category": "food",
    "note": "Ramen in Tokyo",
    "createdAt": "2026-08-04T12:00:00.000Z",
    "baseCurrency": "SGD",
    "currency": "JPY",
    "originalAmount": 1500,
    "rate": 122.458219
  }
}
```

---

### PUT /api/expenses/:id

Update an existing expense.

**Auth required**: Yes

**URL params**: `id` — expense ID

**Request body** (all fields optional):
```json
{
  "date": "2026-08-05",
  "amount": 35.00,
  "category": "transport",
  "note": "Uber to office"
}
```

Accepts the same currency fields as POST. Passing `null` for `currency`,
`originalAmount` or `rate` **removes** the attribute — this is how a foreign-currency
expense is edited back to the base currency.

**Success response** (200):
```json
{
  "expense": { ... }
}
```

**Error response** (404):
```json
{
  "error": "Expense not found"
}
```

---

### DELETE /api/expenses/:id

Delete an expense.

**Auth required**: Yes

**URL params**: `id` — expense ID

**Success response**: 204 No Content

**Error response** (404):
```json
{
  "error": "Expense not found"
}
```

---

## Metadata Endpoints

Per-user settings, stored as a single item at `PK = USER#<userId>`, `SK = META`.

### GET /api/metadata

**Auth required**: Yes

Returns the full settings shape, seeding defaults on a user's first ever call.

```json
{
  "metadata": {
    "categories": [{ "name": "🍜 Food", "subcategories": [] }],
    "baseCurrency": "SGD",
    "currencies": ["JPY", "USD"],
    "updatedAt": "2026-08-04T12:00:00.000Z"
  }
}
```

---

### PUT /api/metadata/categories

**Auth required**: Yes

**Request body**:
```json
{
  "categories": [{ "name": "🍜 Food", "subcategories": ["Drinks"] }],
  "renames": [{ "from": "Food", "to": "🍜 Food" }]
}
```

Renames are applied retroactively to every existing expense, across all months.
Deletions are deliberately not — past expenses keep their old category.

**Success response** (200): `{ "metadata": { ... }, "updatedCount": 12 }`

---

### PUT /api/metadata/currency

**Auth required**: Yes

**Request body**:
```json
{
  "baseCurrency": "SGD",
  "currencies": ["JPY", "USD"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| baseCurrency | string | Yes | 3-letter uppercase ISO code |
| currencies | string[] | No | Additional currencies, must be unique. `baseCurrency` is stripped out if present |

Changing `baseCurrency` does **not** rewrite existing expenses — each expense carries
the `baseCurrency` it was saved under.

**Success response** (200): `{ "metadata": { ... } }`

Both metadata writes are partial patches, so saving currency settings never clobbers
categories and vice versa.

---

## Import Endpoints

Restores expenses from a Money Manager-style `.xlsx` export. Two phases: `analyze`
previews and proposes a category mapping, `commit` writes. Both take
`multipart/form-data` with the file in a `file` field.

The file is uploaded to **both** endpoints. That is deliberate — the server stays the
only thing that interprets the spreadsheet, and no import state has to be held between
the two calls.

### What the source format maps to

| Source column | Becomes |
|---|---|
| `Period` | `date` (read in **UTC**) and `createdAt` (the full timestamp) |
| `Accounts` (×2) | dropped — no account concept; the trailing one duplicates the base amount |
| `Category` + `Subcategory` | `category`, as `Parent` or `Parent#Sub`, via the confirmed mapping |
| `Note` + `Description` | `note`, joined with ` — ` when both are present |
| `<BASE>` (e.g. `SGD`) | `amount`, rounded to 2dp. The header names the file's base currency |
| `Amount` + `Currency` | `originalAmount` + `currency`, with `rate = originalAmount / amount` |
| `Income/Expense` | filter — only `Exp.` rows are imported |

`Period` cells are formatted `dd/MM/yyyy` but hold a real time fraction, so the
time-of-day survives in `createdAt`. Income rows, transfers and account names have no
home in this schema and are skipped or dropped, each with its own count in the response.
Zero amounts are **kept** — in these exports they are deliberate records of a refund, a
voucher, or something a friend paid for.

---

### POST /api/import/analyze

**Auth required**: Yes · **Body**: `multipart/form-data`, field `file`

Parses the upload and reports what would happen. **Writes nothing.**

```json
{
  "baseCurrency": "SGD",
  "totals": { "rows": 450, "importable": 425, "skippedIncome": 25, "skippedTransfer": 0, "skippedInvalid": 0 },
  "zeroAmountRows": 3,
  "dateRange": { "from": "2025-12-31", "to": "2027-01-06" },
  "currencies": ["SGD", "CNY", "MYR", "USD"],
  "accountsDropped": ["MariBank credit card", "POSB Deposit acc", "Cash"],
  "duplicatesFound": 0,
  "mappings": [
    {
      "sourceCategory": "🚖 Transport", "sourceSubcategory": null,
      "parent": "🚗 Transport", "sub": null,
      "count": 9, "parentIsNew": false, "subIsNew": false
    }
  ],
  "warnings": []
}
```

`mappings` holds one entry per distinct (Category, Subcategory) pair. `parent`/`sub` are
a **suggestion**: existing categories are matched with emoji, spacing and case ignored,
so `🚖 Transport` finds the existing `🚗 Transport` instead of creating a near-duplicate.
Anything unmatched is proposed as new (`parentIsNew`/`subIsNew`) and the user confirms or
overrides every row before committing.

**Error response** (400): `{ "error": "..." }` — unreadable file, or missing a required
column (`Period`, `Category`, `Income/Expense`, `Amount`, `Currency`, and one column whose
header is a bare 3-letter currency code).

---

### POST /api/import/commit

**Auth required**: Yes · **Body**: `multipart/form-data`, field `file` + field `mapping`

`mapping` is a JSON string: `{ "mappings": [{ sourceCategory, sourceSubcategory, parent, sub }] }`.
Every pair present in the file must be covered, or the request is rejected 400 without
writing anything.

Categories the mapping invents are appended to the user's metadata (via the same partial
`patch` the categories page uses) **before** the expenses are written, so no imported
expense ever points at a category missing from Settings.

Rows matching an existing expense on `date + amount + note` are skipped, which also
covers duplicates inside the file itself — so re-running an import is a no-op.

**Success response** (200):
```json
{
  "imported": 425,
  "skippedIncome": 25,
  "skippedTransfer": 0,
  "skippedInvalid": 0,
  "skippedDuplicate": 0,
  "categoriesCreated": ["Gaming", "👬🏻 Social Life", "⚽ Sports › Equipment"]
}
```

---

## Error Format

All errors follow this structure:
```json
{
  "error": "Error message describing what went wrong"
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete success) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 404 | Not Found |
| 500 | Internal Server Error |
