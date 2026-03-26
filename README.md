# Gmail Email Viewer

A React application that allows you to search, import, and view Gmail emails with full threading support. Built with TypeScript, designed for easy FastAPI backend integration later.

## Features

- 🔐 **Google OAuth Authentication** - Secure read-only access to Gmail
- 🔍 **Hybrid Search** - User-friendly filters + advanced Gmail query syntax
- 📧 **Threading Support** - View full email conversations with all replies
- 💾 **Session Storage** - Emails stored locally in browser session
- 📱 **Responsive Design** - Works on desktop and mobile
- 🔌 **FastAPI-Ready** - Service layer designed for easy backend integration

## Project Structure

```
src/
├── services/           # API abstraction layer
│   ├── gmail.ts        # Gmail API calls (swap for FastAPI later)
│   └── types.ts        # TypeScript interfaces
├── store/              # Zustand state management
│   └── index.ts        # Auth, Email, and UI stores
├── components/
│   ├── Auth/           # Google login components
│   ├── Search/         # Search panel with filters
│   ├── EmailList/      # Thread list view
│   └── ThreadView/     # Full thread display
├── utils/
│   ├── emailParser.ts  # Gmail response → normalized format
│   └── searchBuilder.ts # Filters → Gmail query syntax
└── App.tsx             # Main application component
```

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - Go to APIs & Services → Library
   - Search for "Gmail API"
   - Click Enable

4. Create OAuth credentials:
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Web application"
   - Add to **Authorized JavaScript origins**:
     - `http://localhost:5173` (for development)
     - Your production domain
   - Copy the **Client ID**

5. Configure OAuth consent screen:
   - Go to APIs & Services → OAuth consent screen
   - Fill in app name, support email
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`

### 2. Project Setup

```bash
# Clone or copy the project
cd gmail-viewer

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your Google Client ID
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com

# Start development server
npm run dev
```

### 3. Usage

1. Open http://localhost:5173
2. Click "Sign in with Google"
3. Grant read-only Gmail access
4. Use the search panel to find emails:
   - Filter mode: Fill in From, To, Subject, Date fields
   - Advanced mode: Use Gmail query syntax directly
5. Click a thread to view the full conversation
6. All messages in the thread are displayed chronologically

## Email Data Format

When you fetch emails from Gmail, they're normalized into this structure:

```typescript
interface NormalizedEmail {
  id: string;                // Gmail message ID
  threadId: string;          // Gmail thread ID
  from: { name, email };     // Sender
  to: [{ name, email }];     // Recipients
  cc: [{ name, email }];     // CC recipients
  subject: string;
  snippet: string;           // Preview text
  bodyText: string;          // Plain text body
  bodyHtml: string;          // HTML body
  date: string;              // ISO timestamp
  messageId: string;         // For threading
  inReplyTo: string | null;  // Parent message
  references: string[];      // Thread references
  hasAttachments: boolean;
  attachments: AttachmentMeta[];
}
```

## Adding FastAPI Backend

The app is designed for easy backend integration. When you're ready:

### 1. Create FastAPI Endpoints

```python
# main.py
from fastapi import FastAPI, Depends
from pydantic import BaseModel

app = FastAPI()

@app.post("/api/auth/google/callback")
async def google_callback(code: str):
    """Exchange auth code for tokens, store in DB"""
    pass

@app.post("/api/emails/search")
async def search_emails(query: SearchQuery, user = Depends(get_current_user)):
    """Proxy to Gmail API with stored tokens"""
    pass

@app.get("/api/emails/thread/{thread_id}")
async def get_thread(thread_id: str, user = Depends(get_current_user)):
    """Fetch full thread from Gmail"""
    pass

@app.post("/api/projects/{project_id}/import")
async def import_threads(threads: List[EmailThread], project_id: str):
    """Save threads to database"""
    pass
```

### 2. Modify Frontend Service

In `src/services/gmail.ts`, change from direct Gmail API calls to FastAPI:

```typescript
// Before (current):
const response = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);

// After (with FastAPI):
const response = await fetch(
  `${FASTAPI_BASE}/api/emails/thread/${threadId}`,
  { headers: { Authorization: `Bearer ${sessionToken}` } }
);
```

The response format stays the same, so UI components don't change!

## Gmail Query Syntax Reference

Examples for advanced search:

| Query | Description |
|-------|-------------|
| `from:boss@company.com` | Emails from a specific sender |
| `to:me is:unread` | Unread emails sent to you |
| `subject:invoice after:2024/01/01` | Invoices from 2024 |
| `has:attachment filename:pdf` | Emails with PDF attachments |
| `"project update" -draft` | Contains phrase, excludes drafts |
| `from:@acme.com` | From any email at acme.com |

## Technologies Used

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Zustand** for state management
- **@react-oauth/google** for Google OAuth
- **date-fns** for date formatting
- **lucide-react** for icons

## Known Limitations (MVP)

- Session storage only (data lost on close)
- No attachment download (view metadata only)
- Max 20 threads per search
- No real-time sync with Gmail

## Future Enhancements

When you add FastAPI backend:
- [ ] Persistent storage in PostgreSQL
- [ ] Attachment download support
- [ ] Incremental sync (detect new emails)
- [ ] Multiple project support
- [ ] AI summarization (Claude)
- [ ] Vector search for semantic queries

## License

MIT
