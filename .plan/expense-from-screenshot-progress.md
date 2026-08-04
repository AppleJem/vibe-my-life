# Expense from Screenshot - Progress Tracker

## Status: 🚀 In Progress

---

## Phase 1: Backend Setup
- [x] Add MIMO_API_KEY to backend .env
- [x] Create `src/modules/screenshot/screenshot.service.ts`
- [x] Create `src/modules/screenshot/screenshot.controller.ts`
- [x] Create `src/modules/screenshot/screenshot.routes.ts`
- [x] Add batch create endpoint to expense routes

## Phase 2: Frontend - Image Selection
- [x] Create `ImagePickerButton` component
- [x] Add long press handler to FAB in index.tsx
- [x] Add upload service to api.ts

## Phase 3: Frontend - Draft Review
- [x] Create `expense-draft.tsx` route
- [x] Create `DraftExpenseItem` component
- [x] Modify AddExpenseModal for draft mode (no auto-save)

## Phase 4: Integration & Testing
- [x] Wire up image selection → upload → parse
- [x] Wire up draft review → edit → batch save
- [x] Add loading spinner with cancel button
- [x] Add error handling and retry logic
- [ ] Test with sample screenshots (requires MIMO_API_KEY)

---

## Status: ✅ Implementation Complete

### Next Steps
1. **Configure API Keys**: Add your keys to `backend/.env`
   - `GEMINI_API_KEY` - Get from https://aistudio.google.com/apikey
   - `MIMO_API_KEY` - Optional fallback
2. **Test the flow**:
   - Start the backend: `cd backend && npm run dev`
   - Start the frontend: `cd frontend && npm run dev`
   - Long-press the FAB button to see the image picker option
   - Select screenshot(s) of expenses
   - Review and edit the parsed items
   - Click "Save" to batch create all items

### Notes
- The AddExpenseModal is reused in draft mode - it calls `onSubmit` instead of saving to DB
- Images are processed in memory and never stored on disk
- Max 5 images per request, 10MB each
- Cancel button aborts the in-progress request
- **Default LLM**: Gemini (faster), with Mimo as fallback

---

## LLM Client Architecture

The LLM client is abstracted behind a clean interface that makes switching models easy:

```
backend/src/modules/llm/
├── llm.types.ts          # Interfaces (LLMProvider, LLMMessage, etc.)
├── llm.client.ts         # Singleton client with provider management
├── index.ts              # Public exports
└── providers/
    ├── gemini.provider.ts  # Google Gemini (default)
    └── mimo.provider.ts    # Xiaomi Mimo (fallback)
```

### Usage Example
```typescript
import { llmClient } from '../llm/index.js'

// Use default provider (Gemini)
const response = await llmClient.complete({ messages })

// Use specific provider
const response = await llmClient.complete({ messages, provider: 'mimo' })

// Check available providers
console.log(llmClient.getAvailableProviders()) // ['gemini', 'mimo']
```

---

## Files Created/Modified

**Backend - LLM Client:**
- `backend/src/modules/llm/llm.types.ts` - Type definitions
- `backend/src/modules/llm/llm.client.ts` - Client singleton with provider management
- `backend/src/modules/llm/index.ts` - Public exports
- `backend/src/modules/llm/providers/gemini.provider.ts` - Gemini implementation
- `backend/src/modules/llm/providers/mimo.provider.ts` - Mimo implementation

**Backend - Screenshot Feature:**
- `backend/src/modules/screenshot/screenshot.service.ts` - Updated to use LLM client
- `backend/src/modules/screenshot/screenshot.controller.ts` - Request handler
- `backend/src/modules/screenshot/screenshot.routes.ts` - Routes with multer
- `backend/src/modules/expense/expense.controller.ts` - Added batchCreateExpenses
- `backend/src/modules/expense/expense.routes.ts` - Added /batch route
- `backend/src/server.ts` - Registered screenshot routes
- `backend/.env` - Added GEMINI_API_KEY
- `backend/.env.example` - Added GEMINI_API_KEY

**Frontend:**
- `frontend/src/components/ExpenseTracker/ImagePickerButton.tsx` - Long press FAB
- `frontend/src/components/ExpenseTracker/ScreenshotLoadingOverlay.tsx` - Loading spinner
- `frontend/src/routes/_authenticated/expense-draft.tsx` - Draft review page
- `frontend/src/routes/_authenticated/index.tsx` - Updated with image picker
- `frontend/src/services/api.ts` - Added screenshot API
