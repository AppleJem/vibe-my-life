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
| `SK` | `S` | `EXPENSE#2026-08-04#a1b2c3d4` | Sort key |
| `id` | `S` | `a1b2c3d4-e5f6-...` | UUID |
| `date` | `S` | `2026-08-04` | YYYY-MM-DD |
| `amount` | `N` | `12.25` | Decimal. **Always in `baseCurrency`** — this is what totals sum |
| `category` | `S` | `food` | Category key |
| `note` | `S` | `Lunch at sushi place` | Optional |
| `createdAt` | `S` | `2026-08-04T12:00:00.000Z` | ISO 8601 |
| `baseCurrency` | `S` | `SGD` | Optional. Base at save time; absent on pre-currency rows |
| `currency` | `S` | `JPY` | Optional. **Absent** when entered in the base currency |
| `originalAmount` | `N` | `1500` | Optional. The amount as typed, in `currency` |
| `rate` | `N` | `122.458219` | Optional. Units of `currency` per 1 base, at save time |

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
| `categories` | `L` | `[{ name, subcategories }]` | User's category tree |
| `baseCurrency` | `S` | `SGD` | Defaults to `SGD` when unset |
| `currencies` | `L` | `["JPY", "USD"]` | Additional currencies; never includes the base |
| `updatedAt` | `S` | `2026-08-04T12:00:00.000Z` | ISO 8601 |

Writes go through `metadataModel.patch`, which `SET`s only the supplied attributes — so the
categories page and the currency page can't overwrite each other's slice.

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
