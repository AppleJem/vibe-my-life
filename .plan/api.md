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
