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
| amount | number | Yes | Must be positive |
| category | string | Yes | Category key |
| note | string | No | Defaults to "" |

**Success response** (201):
```json
{
  "expense": {
    "id": "a1b2c3d4-...",
    "date": "2026-08-04",
    "amount": 42.50,
    "category": "food",
    "note": "Lunch at sushi place",
    "createdAt": "2026-08-04T12:00:00.000Z"
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
