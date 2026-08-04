# Expense from Screenshot Feature Plan

## Overview
Add the ability to create expense items automatically from screenshots by using the Mimo-v2.5 vision model to parse images into structured expense data.

## Architecture

### Frontend Flow
1. **Long-press FAB** → Shows image picker icon above the plus button
2. **Image selection** → Opens device gallery to pick screenshot(s)
3. **Upload & Parse** → Sends images to backend, shows loading spinner with cancel button
4. **Draft Review** → Navigate to new page showing parsed expense items
5. **Edit Items** → Click on each item to edit in modal (reuse AddExpenseModal)
6. **Confirm All** → Batch save all items to database

### Backend Flow
1. **Receive images** → Multer middleware for file upload
2. **Parse with LLM** → Send to Mimo-v2.5 vision API with structured prompt
3. **Return JSON** → Send parsed expense items back to frontend

## Technical Details

### Frontend Components

#### 1. Modify `index.tsx` - Long Press FAB
- Add long press detection (500ms threshold)
- Show image picker icon above FAB on long press
- Use `expo-image-picker` or HTML input for image selection
- Handle multiple image selection

#### 2. New Component: `ScreenshotExpenseFlow.tsx`
- Orchestrates the entire flow
- Manages state: idle → uploading → reviewing → saving
- Contains loading spinner with cancel functionality
- Navigates to draft review page

#### 3. New Route: `_authenticated/expense-draft.tsx`
- Shows list of parsed expense items
- Each item displays: date, amount, category, note
- Click to edit in modal
- Confirm button at bottom for batch save

#### 4. Reuse `AddExpenseModal`
- Add `draftMode` prop to prevent auto-save
- Return edited data without database call
- Close modal and update draft list

### Backend Implementation

#### 1. New Route: `POST /api/expenses/parse-screenshot`
- Multer middleware for multiple images (max 5)
- Auth required

#### 2. New Service: `screenshotParser.service.ts`
- Convert images to base64
- Call Mimo-v2.5 API with structured prompt
- Parse response into expense items
- Validate against expense schema

#### 3. LLM Prompt Design
```
System: You are an expense parser. Extract expense items from screenshots.

User: 
[Image 1]
[Image 2]

Extract all expense items from these screenshots. Return JSON array:
[{
  "date": "YYYY-MM-DD",
  "amount": number,
  "category": "emoji category",
  "note": "description",
  "type": "expense" | "income"
}]

Use these categories: 🍜 Food, 🚗 Transport, 🏠 Household, 👕 Apparel, ⚽ Sports, 📚 Education, 🎁 Gift, 🛒 Shopping, 🏥 Medical, 💕 Dating, ✈️ Travel, 📦 Other
```

## Data Flow

```
Frontend                    Backend                     Mimo API
   │                          │                            │
   │── POST /parse-screenshot ──►│                            │
   │   (multipart/form-data)  │                            │
   │                          │── base64 images ──────────►│
   │                          │                            │
   │                          │◄── JSON expenses ──────────│
   │◄── parsed items ─────────│                            │
   │                          │                            │
   │  [User reviews/edits]    │                            │
   │                          │                            │
   │── POST /expenses/batch ──►│                            │
   │   (array of expenses)    │                            │
   │                          │── save to DynamoDB         │
   │◄── success ──────────────│                            │
```

## Implementation Steps

### Phase 1: Backend
- [ ] Add MIMO_API_KEY to .env
- [ ] Create screenshot parser service
- [ ] Add parse-screenshot route
- [ ] Add batch create endpoint

### Phase 2: Frontend - Image Selection
- [ ] Add long press handler to FAB
- [ ] Create image picker component
- [ ] Add upload service to api.ts

### Phase 3: Frontend - Draft Review
- [ ] Create expense-draft route
- [ ] Build draft item list component
- [ ] Modify AddExpenseModal for draft mode

### Phase 4: Integration
- [ ] Connect upload to parsing
- [ ] Connect draft review to batch save
- [ ] Add error handling and loading states

## Error Handling
- Network errors during upload → Retry option
- LLM parsing failure → Show error, allow retry
- Invalid categories → Map to closest valid category
- Cancel button → Abort request, return to idle state

## Security Considerations
- Images processed in memory, not stored
- API key stored server-side only
- Rate limiting on parse endpoint
- Max file size: 10MB per image, 5 images max
