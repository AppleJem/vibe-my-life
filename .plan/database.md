# Database Design

## DynamoDB Single Table

**Table Name**: `vibe-my-life-expense`

## Schema

| Attribute | Type | Example | Notes |
|-----------|------|---------|-------|
| `PK` | `S` | `USER#me` | Partition key |
| `SK` | `S` | `EXPENSE#2026-08-04#a1b2c3d4` | Sort key |
| `id` | `S` | `a1b2c3d4-e5f6-...` | UUID |
| `date` | `S` | `2026-08-04` | YYYY-MM-DD |
| `amount` | `N` | `42.50` | Decimal |
| `category` | `S` | `food` | Category key |
| `note` | `S` | `Lunch at sushi place` | Optional |
| `createdAt` | `S` | `2026-08-04T12:00:00.000Z` | ISO 8601 |

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
