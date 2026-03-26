/**
 * Email Provider Abstraction
 * 
 * Supports multiple email sources:
 * - Gmail (OAuth)
 * - EML files (upload)
 * - Outlook (future)
 */

import { NormalizedEmail, EmailThread } from '../services/types';

// ============================================
// Email Preview (Lightweight for search)
// ============================================

export interface EmailPreview {
  id: string;
  threadId: string;
  from: string;           // "John Doe <john@example.com>" or just email
  to: string[];           // Array of recipients
  subject: string;
  snippet: string;        // ~100 char preview
  date: Date;
  hasAttachments: boolean;
  isUnread?: boolean;
  
  // For grouping in UI
  source: EmailSource;
}

// ============================================
// Provider Types
// ============================================

export type EmailSource = 'gmail' | 'eml';

export interface EmailProvider {
  type: EmailSource;
  name: string;
  icon: string;           // Lucide icon name
  
  // Search emails (returns lightweight previews)
  search(query: string): Promise<EmailPreview[]>;
  
  // Fetch full email content for selected IDs
  fetchFull(ids: string[]): Promise<NormalizedEmail[]>;
  
  // Check if provider is ready (e.g., authenticated for Gmail)
  isReady(): boolean;
}

// ============================================
// Import State
// ============================================

export interface ImportState {
  source: EmailSource;
  searchQuery: string;
  results: EmailPreview[];
  selectedIds: Set<string>;
  isSearching: boolean;
  isImporting: boolean;
  error: string | null;
}

// ============================================
// EML-specific types
// ============================================

export interface ParsedEmlFile {
  filename: string;
  email: NormalizedEmail;
  preview: EmailPreview;
}

// ============================================
// Fuzzy search helpers
// ============================================

export interface FuzzySearchOptions {
  query: string;
  fields: (keyof EmailPreview)[];
  threshold?: number;  // 0-1, lower = stricter
}

/**
 * Simple fuzzy match score
 * Returns 0-1 (1 = perfect match)
 */
export function fuzzyMatch(text: string, query: string): number {
  if (!query) return 1;
  if (!text) return 0;
  
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  
  // Exact match
  if (normalizedText.includes(normalizedQuery)) {
    return 1;
  }
  
  // Word-by-word matching
  const queryWords = normalizedQuery.split(/\s+/);
  const matchedWords = queryWords.filter(word => 
    normalizedText.includes(word)
  );
  
  if (matchedWords.length > 0) {
    return matchedWords.length / queryWords.length;
  }
  
  // Character sequence matching (for typos)
  let score = 0;
  let textIndex = 0;
  
  for (const char of normalizedQuery) {
    const foundIndex = normalizedText.indexOf(char, textIndex);
    if (foundIndex !== -1) {
      score++;
      textIndex = foundIndex + 1;
    }
  }
  
  return score / normalizedQuery.length * 0.5; // Weight lower for partial
}

/**
 * Search emails with fuzzy matching
 */
export function fuzzySearchEmails(
  emails: EmailPreview[],
  query: string,
  threshold: number = 0.3
): EmailPreview[] {
  if (!query.trim()) return emails;
  
  const scored = emails.map(email => {
    const fromScore = fuzzyMatch(email.from, query);
    const subjectScore = fuzzyMatch(email.subject, query);
    const snippetScore = fuzzyMatch(email.snippet, query);
    
    // Weight: from > subject > snippet
    const totalScore = (fromScore * 0.4) + (subjectScore * 0.4) + (snippetScore * 0.2);
    
    return { email, score: totalScore };
  });
  
  return scored
    .filter(item => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(item => item.email);
}
