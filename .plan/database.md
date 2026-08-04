# Database Design

## DynamoDB Single Table

**Table Name**: `vibe-my-life-expense`

## Schema

| Attribute | Type | Example | Notes |
|-----------|------|---------|-------|
### Expense items

| Attribute | Type | Example | Notes |
|-----------|------|---------|-------|
| `PK` | `S` | `USER#me` | Partition key |
| `SK` | `S` | `EXPENSE#2026-08-04#a1b2c3d4` | Sort key. Prefix is `EXPENSE#` for income too — see below |
| `id` | `S` | `a1b2c3d4-e5f6-...` | UUID |
| `date` | `S` | `2026-08-04` | YYYY-MM-DD |
| `amount` | `N` | `12.25` | Decimal, **always a positive magnitude**. Always in `baseCurrency` |
| `type` | `S` | `expense` | `expense` or `income`. **Absent reads as `expense`** |
| `category` | `S` | `food` | Category key, from the list matching `type` |
| `note` | `S` | `Lunch at sushi place` | Optional |
| `createdAt` | `S` | `2026-08-04T12:00:00.000Z` | ISO 8601 |
| `baseCurrency` | `S` | `SGD` | Optional. Base at save time; absent on pre-currency rows |
| `currency` | `S` | `JPY` | Optional. **Absent** when entered in the base currency |
| `originalAmount` | `N` | `1500` | Optional. The amount as typed, in `currency` |
| `rate` | `N` | `122.458219` | Optional. Units of `currency` per 1 base, at save time |

### Income

Income is the same item shape with `type: "income"`, **not** a separate `INCOME#` sort-key
prefix. One month query therefore returns both directions and the client splits them, which
is why `getByMonth`, `getAll`, `getById`, `update` and `delete` needed no changes when income
shipped. The cost is a cosmetic one: the `EXPENSE#` prefix is now a historical name for
"transaction", not a type.

Two consequences worth remembering:

- `type` is written unconditionally on every new row (unlike the currency fields, which are
  conditionally spread). That keeps flipping a row's direction a plain `SET` rather than a
  `REMOVE`, and it means editing an entry from expense to income never has to move the item.
- Rows written before income existed have no `type` at all, so **every read path treats an
  absent `type` as `expense`** — `typeOf()` in `frontend/src/utils/transaction.ts` and the
  local helper of the same name in `expense.model.ts` are the only places that rule lives.

`amount` stays positive for both directions; the sign is derived at render time. Nothing in
the table is ever stored negative.

`renameCategory` takes a `type` argument and only rewrites rows of that type — expense and
income keep independent category lists and a name can exist in both (🎁 Gift ships in both
sets of defaults), so an unscoped rename would corrupt the other list's rows.

The four currency attributes are additive, so rows written before the feature simply lack
them and are read as base-currency expenses. `currency` being present is the single signal
for "this was a foreign-currency spend" — the UI then shows `amount` large with
`originalAmount` small underneath.

Because `baseCurrency` is a per-expense snapshot, changing the base currency later does not
re-price history. An old row keeps contributing its old-base `amount` to totals; the
snapshot is what makes a proper migration possible if it's ever wanted.

### Metadata item

| Attribute | Type | Example | Notes |
|-----------|------|---------|-------|
| `PK` | `S` | `USER#me` | Partition key |
| `SK` | `S` | `META` | Fixed |
| `categories` | `L` | `[{ name, subcategories }]` | Expense category tree |
| `incomeCategories` | `L` | `[{ name, subcategories }]` | Income category tree. Absent = never set, and reads as the defaults |
| `baseCurrency` | `S` | `SGD` | Defaults to `SGD` when unset |
| `currencies` | `L` | `["JPY", "USD"]` | Additional currencies; never includes the base |
| `updatedAt` | `S` | `2026-08-04T12:00:00.000Z` | ISO 8601 |

Writes go through `metadataModel.patch`, which `SET`s only the supplied attributes — so the
categories page and the currency page can't overwrite each other's slice, and the same
applies between `categories` and `incomeCategories`.

`incomeCategories` is the one attribute whose *absence* differs from an empty list. Users
who existed before income shipped already have a `META` item, so the controller's
first-load seed never fires for them; `toMetadata` therefore returns the income defaults
when the key is missing entirely, while preserving a deliberate `[]`.

Imported rows are ordinary items — the importer adds no attributes beyond `type`. The one
difference is that `createdAt` carries the timestamp from the backup file rather than the
time of the write, which is what preserves within-day ordering for restored history.
Bulk inserts go through `expenseModel.createMany` (`BatchWriteCommand`, 25 items per call,
retrying `UnprocessedItems`).

## Access Patterns

### Get expenses for a month
```
PK = "USER#<userId>"
SK BETWEEN "EXPENSE#2026-08" AND "EXPENSE#2026-08~"
```

The `~` character sorts after all digits and letters in ASCII, so this captures all expenses for `2026-08`.

### Get single expense
```
PK = "USER#<userId>"
SK = "EXPENSE#<date>#<expenseId>"
```

## SK Format Rationale

Using `EXPENSE#YYYY-MM-DD#<uuid>` as SK gives us:
- **Lexicographic date sorting** — expenses come back in chronological order
- **Unique keys** — UUID ensures no collisions
- **Efficient queries** — can query date ranges with `BETWEEN`

## Future Considerations

If we add more entity types later (notes, calendar events), we can extend:
- `SK = "NOTE#<date>#<id>"`
- `SK = "EVENT#<date>#<id>"`

Same PK (`USER#<userId>`) keeps everything user-scoped.
