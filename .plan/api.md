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
| amount | number | Yes | Must be positive **for both types** — the sign is presentation, derived from `type`. Always in the base currency |
| type | string | No | `"expense"` (default) or `"income"` |
| category | string | Yes | Category key, from the list matching `type` |
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
    "type": "expense",
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
    "incomeCategories": [{ "name": "💰 Salary", "subcategories": [] }],
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
  "renames": [{ "from": "Food", "to": "🍜 Food" }],
  "incomeCategories": [{ "name": "💰 Salary", "subcategories": [] }],
  "incomeRenames": [{ "from": "Salary", "to": "💰 Salary" }]
}
```

Both lists are optional and are patched independently, so a client saving only one
cannot clobber the other.

Renames are applied retroactively to every existing row, across all months, and are
**scoped to their own type** — `incomeRenames` never touch expense rows and vice
versa. This matters because the two lists are independent and names may collide
(🎁 Gift ships in both defaults). Deletions are deliberately not applied — past
entries keep their old category.

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

## Recurring Endpoints

Subscriptions and regular income. A *rule* is a schedule stored in `META.recurring`; the
transactions it produces are ordinary expense rows carrying `recurringId` and
`occurrenceDate`.

Every endpoint takes a `today` field in `YYYY-MM-DD`, and it is the **client's local**
today. The server runs in UTC and must not be the one deciding when a day rolls over, or a
subscription fires early in Asia and late in the Americas.

### GET /api/recurring

**Success response** (200): `{ "rules": [ ... ] }`

### POST /api/recurring

Creates a rule and immediately writes anything already due — so a rule starting today
produces its first transaction in the same call, while one starting next week produces
nothing until catch-up reaches that date.

**Request body**: the rule fields (`type`, `frequency`, `startDate`, `amount`, `category`,
`note`, `remarks`, and the optional currency snapshot) plus `today`.

`frequency` is one of `daily` | `weekly` | `monthly` | `yearly`. `startDate` is both the
first occurrence and the anchor the rest are counted from — the weekday for `weekly`, the
day-of-month for `monthly`, the month/day for `yearly`. Occurrences are computed by index
from that anchor, never from the previous result, so month-end clamping doesn't drift: a
rule on the 31st fires on Feb 28 and then Mar **31**.

Foreign-currency rules store a `currency`/`originalAmount`/`rate` snapshot and repeat it
verbatim on every generated row. The server has no FX access; a rule stays priced at the
rate it was created with until someone edits it.

**Success response** (201): `{ "rule": {...}, "created": [...], "months": ["2026-08"] }`

### POST /api/recurring/run

Catch-up. Writes every occurrence each rule owes since it last fired, up to `today`,
across any number of months. Called once per local day per client session, on entry.

**Request body**: `{ "today": "2026-08-04" }`

**Success response** (200): `{ "created": [...], "months": [...] }` — `months` is what the
client invalidates.

Idempotent within a day by way of each rule's `lastRunDate` watermark. A generated row the
user deleted is never resurrected: nothing compares the schedule against the table.

### PUT /api/recurring/:id

**Request body**: the same rule fields, plus:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| propagate | `none` \| `future` \| `all` | No | How far the change reaches into rows already written. Default `none` |
| from | string | No | Lower bound (by `occurrenceDate`) for `propagate: "future"`. Defaults to `today` |
| today | string | Yes | Client's local date |

`future` rewrites rows whose `occurrenceDate` is on or after `from`; `all` rewrites every
row of the rule; `none` touches the rule alone. The rule's fields are updated in all three
cases — "this and all future" means the *schedule* changes too.

`date` is never propagated. An occurrence's date belongs to the occurrence, so
rescheduling a rule doesn't drag written history around.

**Success response** (200): `{ "rule": {...}, "updatedCount": 2, "months": [...] }`

### DELETE /api/recurring/:id

**Query**: `deleteItems=true|false`.

`true` removes every row the rule generated. `false` keeps them but **clears their
`recurringId`/`occurrenceDate`** — a dangling link would still draw the repeat badge and
still prompt for a change scope on a schedule that no longer exists.

**Success response** (200): `{ "deleted": 0, "detached": 2, "months": [...] }`

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
| `Income/Expense` | `type` — `Exp.` and `Income` rows both import; `Transfer` is skipped |

`Period` cells are formatted `dd/MM/yyyy` but hold a real time fraction, so the
time-of-day survives in `createdAt`. Income rows map against the user's **income**
category list; expense rows against the expense one, so the same source name can land
in both. Transfers and account names have no home in this schema and are skipped or
dropped, each with its own count in the response.
Zero amounts are **kept** — in these exports they are deliberate records of a refund, a
voucher, or something a friend paid for.

---

### POST /api/import/analyze

**Auth required**: Yes · **Body**: `multipart/form-data`, field `file`

Parses the upload and reports what would happen. **Writes nothing.**

```json
{
  "baseCurrency": "SGD",
  "totals": { "rows": 450, "importable": 450, "importableIncome": 25, "skippedTransfer": 0, "skippedInvalid": 0 },
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

`mapping` is a JSON string: `{ "mappings": [{ kind, sourceCategory, sourceSubcategory, parent, sub }] }`.
Every (kind, category, subcategory) triple present in the file must be covered, or the
request is rejected 400 without writing anything. `kind` defaults to `"expense"` when
omitted.

Categories the mapping invents are appended to the matching list in the user's metadata
(via the same partial `patch` the categories page uses) **before** the rows are written,
so no imported entry ever points at a category missing from Settings.

Rows matching an existing entry on `type + date + amount + note` are skipped, which also
covers duplicates inside the file itself — so re-running an import is a no-op. `type` is
part of the key so a same-day, same-amount income and expense don't cancel each other out.

**Success response** (200):
```json
{
  "imported": 450,
  "importedIncome": 25,
  "skippedTransfer": 0,
  "skippedInvalid": 0,
  "skippedDuplicate": 0,
  "categoriesCreated": ["Gaming", "👬🏻 Social Life", "⚽ Sports › Equipment"],
  "incomeCategoriesCreated": ["🎠 Carousell"]
}
```

---

## Habit Endpoints

A separate life app from expenses, backed by its own table (`vibe-my-life-habit`). All
routes require auth.

A habit's `type` decides what a completion carries — `boolean` takes no value, `count`
requires `count`, `duration` requires `durationMinutes`. That is validated against the
**stored** definition, not the request body, so sending the wrong one is a 400.

### GET /api/habits

**Response** (200): `{ "habits": [...] }`

```json
{
  "habits": [
    {
      "id": "8c1d8d20-...",
      "name": "Read",
      "emoji": "📚",
      "description": "Twenty pages before bed",
      "type": "count",
      "unit": "pages",
      "target": 10,
      "tags": ["morning"],
      "color": "pink",
      "lastCompletedDate": "2026-08-04",
      "createdAt": "2026-08-01T09:00:00.000Z"
    }
  ]
}
```

`lastCompletedDate` is what the list page's done-today dot reads — comparing it against the
client's own local today. It is absent until the habit has been logged once.

---

### POST /api/habits

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | Yes | |
| emoji | string | Yes | |
| type | string | Yes | `boolean` \| `count` \| `duration` |
| description | string | No | Defaults to `""` |
| unit | string | No | Ignored unless `type` is `count` |
| target | number | No | Positive; optional daily goal |
| tags | string[] | No | Defaults to `[]` |
| color | string | No | Defaults to `pink` |

**Response** (201): `{ "habit": { ... } }`

---

### GET /api/habits/:id

**Response** (200): `{ "habit": { ... } }`, or 404.

---

### PUT /api/habits/:id

Partial of the create body, plus `archived: boolean`. `unit` and `target` accept `null` to
clear them.

Changing `type` to anything but `count` clears `unit` server-side — the client does not
have to remember to send the null.

**Response** (200): `{ "habit": { ... } }`, or 404.

---

### DELETE /api/habits/:id

Cascades: the habit's entire completion history goes with it.

**Response**: `204 No Content`

---

### GET /api/habits/:id/completions

The whole history, oldest first. Not paginated and not date-bounded — see
`.plan/database.md` for why.

**Response** (200):
```json
{
  "completions": [
    {
      "habitId": "8c1d8d20-...",
      "timestamp": "2026-08-04T14:36:51.379Z",
      "date": "2026-08-04",
      "notes": "Finished chapter 3",
      "count": 12,
      "unit": "pages"
    }
  ]
}
```

---

### POST /api/habits/:id/completions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| date | string | Yes | `YYYY-MM-DD`, the **client's local day** |
| notes | string | No | Defaults to `""` |
| count | number | Yes for `count` habits | Positive; rejected on other types |
| durationMinutes | number | Yes for `duration` habits | Positive; rejected on other types |

`date` is required and comes from `localToday()` on the client. The server is UTC and must
not be the one deciding when a day rolls over.

**Response** (201):
```json
{
  "completion": { "...": "..." },
  "habit": { "...": "..." }
}
```

The updated habit rides along so the list cache can be refreshed without a second round
trip — `lastCompletedDate` has just moved.

**Errors**: `409 { "error": "Already logged for this day" }` when that habit already has a
completion on `date`. One per day is a server-side rule, not just a UI state.

---

### DELETE /api/habits/:id/completions/:timestamp

`timestamp` is an ISO string, so it must be `encodeURIComponent`'d into the path.

**Response** (200): `{ "habit": { ... } }` — the habit with `lastCompletedDate`
recomputed from whatever completions survive, which may move it backwards or remove it.

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
| 409 | Conflict (habit already logged for that day) |
| 500 | Internal Server Error |
