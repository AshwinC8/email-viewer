/**
 * Email Data Types
 * 
 * These types are designed to be:
 * 1. Clean and normalized (vs Gmail's nested structure)
 * 2. Ready for database storage (PostgreSQL)
 * 3. Easy to serialize/deserialize for session storage
 * 
 * When you add FastAPI backend, these types will map directly to SQLAlchemy models.
 */

// ============================================
// Participant Types
// ============================================

export interface EmailParticipant {
  name: string;
  email: string;
}

// ============================================
// Normalized Email (Single Message)
// ============================================

export interface NormalizedEmail {
  // Core identifiers
  id: string;           // Gmail message ID
  threadId: string;     // Gmail thread ID
  
  // Participants
  from: EmailParticipant;
  to: EmailParticipant[];
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  
  // Content
  subject: string;
  snippet: string;      // Preview text (~100 chars)
  bodyText: string;     // Plain text version
  bodyHtml: string;     // HTML version
  
  // Timestamps
  date: string;         // ISO string for serialization
  internalDate: number; // Unix timestamp (ms)
  
  // Labels/Status
  labels: string[];
  isUnread: boolean;
  isStarred: boolean;
  
  // Threading headers (for building conversation tree)
  messageId: string | null;     // Message-ID header
  inReplyTo: string | null;     // In-Reply-To header
  references: string[];         // References header (array)
  
  // Attachment metadata (for future use)
  hasAttachments: boolean;
  attachments: AttachmentMeta[];
}

// ============================================
// Attachment Metadata (for future use)
// ============================================

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ============================================
// Email Thread (Grouped Conversation)
// ============================================

export interface EmailThread {
  threadId: string;
  subject: string;
  
  // All unique participants across the thread
  participants: EmailParticipant[];
  
  // Thread stats
  messageCount: number;
  unreadCount: number;
  
  // Messages ordered by date (oldest first)
  messages: NormalizedEmail[];
  
  // Convenience timestamps
  firstMessageDate: string;
  lastMessageDate: string;
  
  // Preview (from latest message)
  snippet: string;
  
  // Labels present in any message
  labels: string[];
}

// ============================================
// Search Types
// ============================================

export interface SearchFilters {
  from?: string;
  to?: string;
  subject?: string;
  hasWords?: string;       // Words in body
  doesntHave?: string;     // Exclude words
  dateAfter?: string;      // YYYY/MM/DD
  dateBefore?: string;     // YYYY/MM/DD
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  label?: string;
}

export interface SearchQuery {
  // Either use filters or raw query
  filters?: SearchFilters;
  rawQuery?: string;       // Gmail query syntax
}

// ============================================
// Gmail API Raw Response Types
// (These are what Gmail actually returns)
// ============================================

export interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers?: GmailHeader[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string;  // Base64 URL-safe encoded
  };
  parts?: GmailMessagePart[];  // Nested for multipart
}

export interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
}

export interface GmailThreadResponse {
  id: string;
  historyId: string;
  messages: GmailMessageResponse[];
}

// ============================================
// App State Types
// ============================================

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: {
    email: string;
    name: string;
    picture: string;
  } | null;
}

export interface EmailState {
  threads: EmailThread[];
  selectedThread: EmailThread | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: SearchQuery | null;
}

// ============================================
// API Response Types (for future FastAPI)
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
