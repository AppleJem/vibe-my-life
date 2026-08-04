# Backend Plan

## Environment Variables

```env
# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# DynamoDB
DYNAMO_TABLE_NAME=vibe-my-life-expense

# Auth
JWT_SECRET=your-secret-key
LOGIN_USERNAME=
LOGIN_PASSWORD=

# Server
PORT=3001
```

## Config Layer

### `config/env.ts`
- Load with `dotenv`
- Validate all required vars using Zod schema
- Export typed `env` object
- Fail fast on startup if any var missing

### `config/db.ts`
- Initialize `DynamoDBClient` with AWS credentials from env
- Create `DynamoDBDocumentClient` from client
- Export doc client for use in model files

## Auth Module

### Architecture (Extensible for Google)

```typescript
// auth.service.ts — strategy pattern
export const authService = {
  // Current
  async loginWithCredentials(username: string, password: string): Promise<string> {
    // Compare with env vars
    // Return JWT
  },

  // Future
  async loginWithGoogle(token: string): Promise<string> {
    // Verify Google token
    // Return JWT
  },

  async verify(token: string): { userId: string; method: string } {
    // Verify JWT
    // Return payload
  }
};
```

### JWT Payload
```typescript
{
  userId: "me",           // Hardcoded for now
  method: "credentials"   // or "google" later
}
```

### Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login with credentials → `{ token }` |

### Auth Middleware
- Extract `Authorization: Bearer <token>` header
- Verify with `authService.verify()`
- Attach `userId` to `req` object
- Return 401 if invalid/missing

## Expense Module

### DynamoDB Schema

| Attribute | Type | Example |
|-----------|------|---------|
| `PK` | `S` | `USER#me` |
| `SK` | `S` | `EXPENSE#2026-08-04#a1b2c3d4` |
| `id` | `S` | `a1b2c3d4-...` |
| `date` | `S` | `2026-08-04` |
| `amount` | `N` | `42.50` |
| `category` | `S` | `food` |
| `note` | `S` | `Lunch at sushi place` |
| `createdAt` | `S` | `2026-08-04T12:00:00.000Z` |

### Query Patterns

**Get monthly expenses**:
```
PK = "USER#<userId>"
SK BETWEEN "EXPENSE#2026-08" AND "EXPENSE#2026-08~"
```
Uses lexicographic sort — `~` sorts after digits/letters.

### Model Functions (`expense.model.ts`)

```typescript
// Basic DB operations only, no business logic
export const expenseModel = {
  async create(userId: string, expense: CreateExpenseInput): Promise<Expense>
  async getByMonth(userId: string, yearMonth: string): Promise<Expense[]>
  async getById(userId: string, expenseId: string): Promise<Expense | null>
  async update(userId: string, expenseId: string, updates: UpdateExpenseInput): Promise<Expense>
  async delete(userId: string, expenseId: string): Promise<void>
};
```

### Controller Functions (`expense.controller.ts`)

- `createExpense` — validate body with Zod, call model, return 201
- `getExpenses` — parse `?month=YYYY-MM` query, call model
- `updateExpense` — validate body, call model
- `deleteExpense` — call model, return 204

### Routes

| Method | Route | Auth | Body/Query | Response |
|--------|-------|------|------------|----------|
| GET | `/api/expenses` | ✅ | `?month=2026-08` | `{ expenses[] }` |
| POST | `/api/expenses` | ✅ | `{ date, amount, category, note }` | `{ expense }` |
| PUT | `/api/expenses/:id` | ✅ | `{ date?, amount?, category?, note? }` | `{ expense }` |
| DELETE | `/api/expenses/:id` | ✅ | — | `204 No Content` |

### Validation Schemas (Zod)

```typescript
// expense.types.d.ts or inline
const CreateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  category: z.string().min(1),
  note: z.string().optional().default(""),
});

const UpdateExpenseSchema = CreateExpenseSchema.partial();
```

## Middleware

### `authMiddleware.ts`
- Extracts Bearer token from Authorization header
- Verifies JWT and attaches userId to request
- Returns 401 on failure

### `errorHandler.ts`
- Catches unhandled errors
- Returns structured error response
- Logs errors server-side

## Dependencies

```json
{
  "dependencies": {
    "express": "^4.x",
    "cors": "^2.x",
    "helmet": "^8.x",
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x",
    "jsonwebtoken": "^9.x",
    "uuid": "^11.x",
    "zod": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/express": "^5.x",
    "@types/cors": "^2.x",
    "@types/jsonwebtoken": "^9.x",
    "@types/uuid": "^10.x"
  }
}
```
