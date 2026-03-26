/**
 * Gmail Service
 * 
 * This is the API abstraction layer. All Gmail API calls go through here.
 * 
 * IMPORTANT: When you add FastAPI backend, you only need to change this file.
 * - Replace direct Gmail API calls with FastAPI endpoint calls
 * - The rest of the app stays the same
 * 
 * Current: React → Gmail API
 * Future:  React → FastAPI → Gmail API
 */

import {
  GmailMessageListResponse,
  GmailMessageResponse,
  GmailThreadResponse,
  NormalizedEmail,
  EmailThread,
  SearchQuery,
} from './types';

import { parseGmailMessage, buildThread } from '../utils/emailParser';
import { getQueryString } from '../utils/searchBuilder';

// ============================================
// Configuration
// ============================================

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Maximum results per page
const MAX_RESULTS = 50;

// ============================================
// API Client Setup
// ============================================

/**
 * Create headers with auth token
 */
function createHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make API request with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${GMAIL_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...createHeaders(accessToken),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`Gmail API Error: ${errorMessage}`);
  }
  
  return response.json();
}

// ============================================
// Search & List Messages
// ============================================

/**
 * Search for messages matching a query
 * Returns message IDs (not full content)
 */
export async function searchMessages(
  accessToken: string,
  query: SearchQuery,
  pageToken?: string
): Promise<{
  messageIds: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  totalEstimate?: number;
}> {
  const queryString = getQueryString(query);
  
  const params = new URLSearchParams({
    maxResults: String(MAX_RESULTS),
  });
  
  if (queryString) {
    params.set('q', queryString);
  }
  
  if (pageToken) {
    params.set('pageToken', pageToken);
  }
  
  const response = await apiRequest<GmailMessageListResponse>(
    `/messages?${params.toString()}`,
    accessToken
  );
  
  return {
    messageIds: response.messages || [],
    nextPageToken: response.nextPageToken,
    totalEstimate: response.resultSizeEstimate,
  };
}

// ============================================
// Fetch Full Message Content
// ============================================

/**
 * Get full message content by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<NormalizedEmail> {
  const params = new URLSearchParams({
    format: 'full',
  });
  
  const response = await apiRequest<GmailMessageResponse>(
    `/messages/${messageId}?${params.toString()}`,
    accessToken
  );
  
  return parseGmailMessage(response);
}

/**
 * Get multiple messages by IDs
 * Uses batch fetching for efficiency
 */
export async function getMessages(
  accessToken: string,
  messageIds: string[]
): Promise<NormalizedEmail[]> {
  // Fetch in parallel with concurrency limit
  const BATCH_SIZE = 10;
  const results: NormalizedEmail[] = [];
  
  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((id) => getMessage(accessToken, id))
    );
    results.push(...batchResults);
  }
  
  return results;
}

// ============================================
// Thread Operations
// ============================================

/**
 * Get full thread by thread ID
 * Returns all messages in the conversation
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<EmailThread> {
  const params = new URLSearchParams({
    format: 'full',
  });
  
  const response = await apiRequest<GmailThreadResponse>(
    `/threads/${threadId}?${params.toString()}`,
    accessToken
  );
  
  // Parse all messages in thread
  const messages = response.messages.map(parseGmailMessage);
  
  // Build thread object
  return buildThread(messages);
}

/**
 * Get multiple threads
 */
export async function getThreads(
  accessToken: string,
  threadIds: string[]
): Promise<EmailThread[]> {
  // Deduplicate thread IDs
  const uniqueIds = [...new Set(threadIds)];
  
  // Fetch in parallel with concurrency limit
  const BATCH_SIZE = 5;
  const results: EmailThread[] = [];
  
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((id) => getThread(accessToken, id))
    );
    results.push(...batchResults);
  }
  
  // Sort by last message date (newest first)
  results.sort(
    (a, b) =>
      new Date(b.lastMessageDate).getTime() -
      new Date(a.lastMessageDate).getTime()
  );
  
  return results;
}

// ============================================
// Search & Fetch Combined (Main Entry Point)
// ============================================

/**
 * Search for emails and fetch their full thread content
 * This is the main function you'll call from the UI
 */
export async function searchAndFetchThreads(
  accessToken: string,
  query: SearchQuery,
  options: {
    maxThreads?: number;
    onProgress?: (loaded: number, total: number) => void;
  } = {}
): Promise<EmailThread[]> {
  const { maxThreads = 20, onProgress } = options;
  
  // Step 1: Search for matching message IDs
  const searchResult = await searchMessages(accessToken, query);
  
  if (!searchResult.messageIds.length) {
    return [];
  }
  
  // Step 2: Extract unique thread IDs
  const threadIds = [
    ...new Set(searchResult.messageIds.map((m) => m.threadId)),
  ].slice(0, maxThreads);
  
  // Step 3: Fetch full thread content
  const threads: EmailThread[] = [];
  
  for (let i = 0; i < threadIds.length; i++) {
    const thread = await getThread(accessToken, threadIds[i]);
    threads.push(thread);
    
    if (onProgress) {
      onProgress(i + 1, threadIds.length);
    }
  }
  
  // Sort by last message date
  threads.sort(
    (a, b) =>
      new Date(b.lastMessageDate).getTime() -
      new Date(a.lastMessageDate).getTime()
  );
  
  return threads;
}

// ============================================
// User Profile
// ============================================

interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

/**
 * Get user's Gmail profile info
 */
export async function getProfile(accessToken: string): Promise<GmailProfile> {
  return apiRequest<GmailProfile>('/profile', accessToken);
}

// ============================================
// Labels (for filtering)
// ============================================

interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

interface LabelsResponse {
  labels: GmailLabel[];
}

/**
 * Get all available labels
 */
export async function getLabels(accessToken: string): Promise<GmailLabel[]> {
  const response = await apiRequest<LabelsResponse>('/labels', accessToken);
  return response.labels;
}

// ============================================
// Session Storage Helpers
// ============================================

const STORAGE_KEYS = {
  threads: 'ooloor_threads',
  lastQuery: 'ooloor_lastQuery',
};

/**
 * Save threads to session storage
 */
export function saveThreadsToSession(threads: EmailThread[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.threads, JSON.stringify(threads));
  } catch (error) {
    console.error('Failed to save threads to session:', error);
  }
}

/**
 * Load threads from session storage
 */
export function loadThreadsFromSession(): EmailThread[] | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.threads);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load threads from session:', error);
  }
  return null;
}

/**
 * Save last query to session
 */
export function saveQueryToSession(query: SearchQuery): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.lastQuery, JSON.stringify(query));
  } catch (error) {
    console.error('Failed to save query to session:', error);
  }
}

/**
 * Load last query from session
 */
export function loadQueryFromSession(): SearchQuery | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.lastQuery);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load query from session:', error);
  }
  return null;
}

/**
 * Clear all stored data
 */
export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.threads);
  sessionStorage.removeItem(STORAGE_KEYS.lastQuery);
}

// ============================================
// Future FastAPI Integration
// ============================================

/*
 * When you add FastAPI backend, you'll create these endpoints:
 * 
 * POST /api/auth/google/callback    - Exchange Google auth code for tokens
 * POST /api/emails/search           - Search emails (proxy to Gmail)
 * GET  /api/emails/thread/:id       - Get full thread
 * POST /api/emails/import           - Save threads to database
 * GET  /api/projects/:id/threads    - Get saved threads for a project
 * 
 * Then change the functions above to call your FastAPI instead:
 * 
 * // Instead of:
 * await apiRequest<GmailThreadResponse>(`/threads/${threadId}`, accessToken);
 * 
 * // You'll do:
 * await fetch(`${FASTAPI_BASE}/api/emails/thread/${threadId}`, {
 *   headers: { Authorization: `Bearer ${sessionToken}` }
 * });
 * 
 * The response format stays the same, so UI code doesn't change!
 */
