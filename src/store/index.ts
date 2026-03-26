/**
 * App State Management
 * 
 * Using Zustand for simple, scalable state management.
 * 
 * Stores:
 * - AuthStore: Google OAuth state
 * - ProjectStore: Imported emails for the project
 * - UIStore: UI state (modals, views)
 */

import { create } from 'zustand';
import { NormalizedEmail, EmailThread, EmailParticipant } from '../services/types';

// ============================================
// Auth Store
// ============================================

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: {
    email: string;
    name: string;
    picture: string;
  } | null;
  
  // Actions
  setAuth: (token: string, user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  accessToken: null,
  user: null,
  
  setAuth: (token, user) => set({
    isAuthenticated: true,
    accessToken: token,
    user,
  }),
  
  logout: () => set({
    isAuthenticated: false,
    accessToken: null,
    user: null,
  }),
}));

// ============================================
// Project Store (Imported Emails)
// ============================================

interface ProjectState {
  // Imported emails (flat list)
  emails: NormalizedEmail[];
  
  // Computed threads (grouped by threadId)
  threads: EmailThread[];
  
  // Selected thread for viewing
  selectedThreadId: string | null;
  
  // Loading/error state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  importEmails: (newEmails: NormalizedEmail[]) => void;
  removeEmail: (id: string) => void;
  clearAll: () => void;
  selectThread: (threadId: string | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Build threads from flat email list
 */
function buildThreads(emails: NormalizedEmail[]): EmailThread[] {
  // Group by threadId
  const threadMap = new Map<string, NormalizedEmail[]>();
  
  for (const email of emails) {
    const threadId = email.threadId || email.id;
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, []);
    }
    threadMap.get(threadId)!.push(email);
  }
  
  // Build thread objects
  const threads: EmailThread[] = [];
  
  for (const [threadId, messages] of threadMap) {
    // Sort by date (oldest first)
    messages.sort((a, b) => a.internalDate - b.internalDate);
    
    // Collect unique participants
    const participantMap = new Map<string, EmailParticipant>();
    for (const msg of messages) {
      if (msg.from.email) {
        participantMap.set(msg.from.email, msg.from);
      }
      for (const p of [...msg.to, ...msg.cc]) {
        if (p.email) {
          participantMap.set(p.email, p);
        }
      }
    }
    
    // Collect unique labels
    const labels = new Set<string>();
    for (const msg of messages) {
      for (const label of msg.labels) {
        labels.add(label);
      }
    }
    
    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];
    
    threads.push({
      threadId,
      subject: firstMsg.subject,
      participants: Array.from(participantMap.values()),
      messageCount: messages.length,
      unreadCount: messages.filter(m => m.isUnread).length,
      messages,
      firstMessageDate: firstMsg.date,
      lastMessageDate: lastMsg.date,
      snippet: lastMsg.snippet,
      labels: Array.from(labels),
    });
  }
  
  // Sort threads by last message date (newest first)
  threads.sort((a, b) => 
    new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime()
  );
  
  return threads;
}

// Session storage helpers
const STORAGE_KEY = 'ooloor_imported_emails';

function saveToSession(emails: NormalizedEmail[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
  } catch (e) {
    console.error('Failed to save to session storage:', e);
  }
}

function loadFromSession(): NormalizedEmail[] {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load from session storage:', e);
    return [];
  }
}

// Initialize from session storage
const initialEmails = loadFromSession();

export const useProjectStore = create<ProjectState>((set, get) => ({
  emails: initialEmails,
  threads: buildThreads(initialEmails),
  selectedThreadId: null,
  isLoading: false,
  error: null,
  
  importEmails: (newEmails) => {
    const current = get().emails;
    
    // Merge, avoiding duplicates by ID
    const emailMap = new Map(current.map(e => [e.id, e]));
    for (const email of newEmails) {
      emailMap.set(email.id, email);
    }
    
    const merged = Array.from(emailMap.values());
    const threads = buildThreads(merged);
    
    // Persist to session
    saveToSession(merged);
    
    set({
      emails: merged,
      threads,
    });
  },
  
  removeEmail: (id) => {
    const current = get().emails;
    const filtered = current.filter(e => e.id !== id);
    const threads = buildThreads(filtered);
    
    saveToSession(filtered);
    
    set({
      emails: filtered,
      threads,
      // Deselect if the removed email's thread is selected
      selectedThreadId: get().selectedThreadId && 
        !threads.find(t => t.threadId === get().selectedThreadId)
          ? null 
          : get().selectedThreadId,
    });
  },
  
  clearAll: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({
      emails: [],
      threads: [],
      selectedThreadId: null,
    });
  },
  
  selectThread: (threadId) => set({ selectedThreadId: threadId }),
  
  setError: (error) => set({ error }),
}));

// ============================================
// UI Store
// ============================================

interface UIState {
  // Import modal
  isImportModalOpen: boolean;
  
  // Mobile view state
  activeView: 'list' | 'thread';
  
  // Actions
  openImportModal: () => void;
  closeImportModal: () => void;
  setActiveView: (view: 'list' | 'thread') => void;
}

export const useUIStore = create<UIState>((set) => ({
  isImportModalOpen: false,
  activeView: 'list',
  
  openImportModal: () => set({ isImportModalOpen: true }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  setActiveView: (view) => set({ activeView: view }),
}));

// ============================================
// Selectors (Derived State)
// ============================================

/**
 * Get the currently selected thread
 */
export function useSelectedThread(): EmailThread | null {
  const { threads, selectedThreadId } = useProjectStore();
  if (!selectedThreadId) return null;
  return threads.find(t => t.threadId === selectedThreadId) || null;
}

/**
 * Get stats about imported emails
 */
export function useProjectStats() {
  const { emails, threads } = useProjectStore();
  
  return {
    totalEmails: emails.length,
    totalThreads: threads.length,
    gmailCount: emails.filter(e => e.labels.includes('INBOX') || !e.labels.includes('EML')).length,
    emlCount: emails.filter(e => e.labels.includes('EML')).length,
  };
}
