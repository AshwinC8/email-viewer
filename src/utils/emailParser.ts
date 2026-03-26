/**
 * Email Parser Utility
 * 
 * Transforms Gmail API's nested, Base64-encoded responses
 * into our clean, normalized format.
 * 
 * Key transformations:
 * 1. Base64 URL-safe decoding of body content
 * 2. Header extraction (From, To, Subject, etc.)
 * 3. Participant parsing ("John Doe <john@example.com>" → {name, email})
 * 4. Multipart body handling (text/plain vs text/html)
 * 5. Attachment metadata extraction
 */

import {
  GmailMessageResponse,
  GmailMessagePart,
  GmailHeader,
  NormalizedEmail,
  EmailParticipant,
  AttachmentMeta,
  EmailThread,
} from '../services/types';

// ============================================
// Base64 Decoding (Gmail uses URL-safe Base64)
// ============================================

/**
 * Decode Gmail's URL-safe Base64 encoded content
 * Gmail replaces + with - and / with _ in Base64
 */
export function decodeBase64(data: string): string {
  try {
    // Replace URL-safe chars back to standard Base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode Base64 to binary string
    const binaryString = atob(base64);
    
    // Convert binary string to UTF-8
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('Base64 decode error:', error);
    return '';
  }
}

// ============================================
// Header Extraction
// ============================================

/**
 * Find a header value by name (case-insensitive)
 */
export function getHeader(
  headers: GmailHeader[] | undefined,
  name: string
): string {
  if (!headers) return '';
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

// ============================================
// Participant Parsing
// ============================================

/**
 * Parse email address string into structured format
 * Handles formats:
 * - "John Doe <john@example.com>"
 * - "john@example.com"
 * - "<john@example.com>"
 */
export function parseEmailAddress(addressString: string): EmailParticipant {
  if (!addressString) {
    return { name: '', email: '' };
  }

  // Try to match "Name <email>" format
  const match = addressString.match(/^([^<]*)<([^>]+)>$/);
  
  if (match) {
    return {
      name: match[1].trim().replace(/"/g, ''),
      email: match[2].trim().toLowerCase(),
    };
  }
  
  // Just an email address
  const email = addressString.trim().toLowerCase();
  return {
    name: email.split('@')[0], // Use local part as name
    email: email,
  };
}

/**
 * Parse comma-separated list of addresses
 * "John <john@ex.com>, Jane <jane@ex.com>" → [{...}, {...}]
 */
export function parseEmailAddressList(addressList: string): EmailParticipant[] {
  if (!addressList) return [];
  
  // Split by comma, but be careful of commas in names
  // Use a simple approach - split and reassemble if needed
  const parts = addressList.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  
  return parts
    .map((part) => parseEmailAddress(part.trim()))
    .filter((p) => p.email); // Remove empty entries
}

// ============================================
// Body Extraction (Multipart handling)
// ============================================

interface ExtractedBody {
  text: string;
  html: string;
}

/**
 * Recursively extract body content from multipart message
 */
export function extractBody(payload: GmailMessagePart): ExtractedBody {
  const result: ExtractedBody = { text: '', html: '' };
  
  const mimeType = payload.mimeType || '';
  
  // Simple case: direct body content
  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    
    if (mimeType === 'text/plain') {
      result.text = decoded;
    } else if (mimeType === 'text/html') {
      result.html = decoded;
    }
  }
  
  // Multipart: recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const partBody = extractBody(part);
      
      // Accumulate (first non-empty wins for each type)
      if (!result.text && partBody.text) {
        result.text = partBody.text;
      }
      if (!result.html && partBody.html) {
        result.html = partBody.html;
      }
    }
  }
  
  return result;
}

// ============================================
// Attachment Extraction
// ============================================

/**
 * Extract attachment metadata from message parts
 */
export function extractAttachments(payload: GmailMessagePart): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];
  
  function walkParts(part: GmailMessagePart) {
    // Check if this part is an attachment
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }
    
    // Recurse into nested parts
    if (part.parts) {
      part.parts.forEach(walkParts);
    }
  }
  
  walkParts(payload);
  return attachments;
}

// ============================================
// Main Parser: Gmail Response → Normalized Email
// ============================================

/**
 * Transform a Gmail API message response into our normalized format
 */
export function parseGmailMessage(raw: GmailMessageResponse): NormalizedEmail {
  const headers = raw.payload.headers || [];
  
  // Extract body content
  const body = extractBody(raw.payload);
  
  // Extract attachments
  const attachments = extractAttachments(raw.payload);
  
  // Parse participants
  const from = parseEmailAddress(getHeader(headers, 'From'));
  const to = parseEmailAddressList(getHeader(headers, 'To'));
  const cc = parseEmailAddressList(getHeader(headers, 'Cc'));
  const bcc = parseEmailAddressList(getHeader(headers, 'Bcc'));
  
  // Parse threading headers
  const references = getHeader(headers, 'References')
    .split(/\s+/)
    .filter(Boolean);
  
  // Check labels
  const labels = raw.labelIds || [];
  const isUnread = labels.includes('UNREAD');
  const isStarred = labels.includes('STARRED');
  
  // Parse date
  const dateHeader = getHeader(headers, 'Date');
  const internalDate = parseInt(raw.internalDate, 10);
  const date = dateHeader 
    ? new Date(dateHeader).toISOString()
    : new Date(internalDate).toISOString();
  
  return {
    id: raw.id,
    threadId: raw.threadId,
    from,
    to,
    cc,
    bcc,
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    snippet: raw.snippet,
    bodyText: body.text,
    bodyHtml: body.html,
    date,
    internalDate,
    labels,
    isUnread,
    isStarred,
    messageId: getHeader(headers, 'Message-ID') || null,
    inReplyTo: getHeader(headers, 'In-Reply-To') || null,
    references,
    hasAttachments: attachments.length > 0,
    attachments,
  };
}

// ============================================
// Thread Builder
// ============================================

/**
 * Build an EmailThread from an array of normalized messages
 */
export function buildThread(messages: NormalizedEmail[]): EmailThread {
  if (messages.length === 0) {
    throw new Error('Cannot build thread from empty messages array');
  }
  
  // Sort messages by date (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => a.internalDate - b.internalDate
  );
  
  // Get all unique participants
  const participantMap = new Map<string, EmailParticipant>();
  
  sortedMessages.forEach((msg) => {
    // Add from
    if (msg.from.email) {
      participantMap.set(msg.from.email, msg.from);
    }
    // Add to
    msg.to.forEach((p) => {
      if (p.email) participantMap.set(p.email, p);
    });
    // Add cc
    msg.cc.forEach((p) => {
      if (p.email) participantMap.set(p.email, p);
    });
  });
  
  // Collect all unique labels
  const labelSet = new Set<string>();
  sortedMessages.forEach((msg) => {
    msg.labels.forEach((l) => labelSet.add(l));
  });
  
  // Count unread
  const unreadCount = sortedMessages.filter((m) => m.isUnread).length;
  
  // Get subject from first message
  const subject = sortedMessages[0].subject;
  
  // Get snippet from last message
  const snippet = sortedMessages[sortedMessages.length - 1].snippet;
  
  return {
    threadId: sortedMessages[0].threadId,
    subject,
    participants: Array.from(participantMap.values()),
    messageCount: sortedMessages.length,
    unreadCount,
    messages: sortedMessages,
    firstMessageDate: sortedMessages[0].date,
    lastMessageDate: sortedMessages[sortedMessages.length - 1].date,
    snippet,
    labels: Array.from(labelSet),
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Strip HTML tags for plain text display
 */
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * Get display name for a participant
 * Returns name if available, otherwise email
 */
export function getDisplayName(participant: EmailParticipant): string {
  return participant.name || participant.email;
}

/**
 * Get initials for avatar
 */
export function getInitials(participant: EmailParticipant): string {
  const name = participant.name || participant.email;
  const parts = name.split(/[\s@]+/);
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Format participant list for display
 * "John, Jane, +2 others"
 */
export function formatParticipants(
  participants: EmailParticipant[],
  maxShow: number = 2
): string {
  if (participants.length === 0) return '';
  
  const names = participants.map((p) => p.name || p.email.split('@')[0]);
  
  if (names.length <= maxShow) {
    return names.join(', ');
  }
  
  const shown = names.slice(0, maxShow);
  const remaining = names.length - maxShow;
  
  return `${shown.join(', ')} +${remaining} others`;
}
