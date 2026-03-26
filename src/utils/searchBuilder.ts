/**
 * Search Query Builder
 * 
 * Converts user-friendly search filters into Gmail query syntax.
 * Gmail uses a specific query language:
 * - from:john@example.com
 * - to:jane@example.com
 * - subject:meeting
 * - after:2024/01/01
 * - before:2024/12/31
 * - has:attachment
 * - is:unread
 * - is:starred
 * - label:important
 * 
 * Reference: https://support.google.com/mail/answer/7190
 */

import { SearchFilters, SearchQuery } from '../services/types';

/**
 * Build Gmail query string from search filters
 */
export function buildGmailQuery(filters: SearchFilters): string {
  const parts: string[] = [];
  
  // From filter
  if (filters.from?.trim()) {
    parts.push(`from:${filters.from.trim()}`);
  }
  
  // To filter
  if (filters.to?.trim()) {
    parts.push(`to:${filters.to.trim()}`);
  }
  
  // Subject filter
  if (filters.subject?.trim()) {
    // Wrap in quotes if contains spaces
    const subject = filters.subject.trim();
    if (subject.includes(' ')) {
      parts.push(`subject:"${subject}"`);
    } else {
      parts.push(`subject:${subject}`);
    }
  }
  
  // Has words (in body)
  if (filters.hasWords?.trim()) {
    // Just add the words - Gmail searches body by default
    parts.push(filters.hasWords.trim());
  }
  
  // Doesn't have words
  if (filters.doesntHave?.trim()) {
    const words = filters.doesntHave.trim().split(/\s+/);
    words.forEach((word) => {
      parts.push(`-${word}`);
    });
  }
  
  // Date after (must be YYYY/MM/DD format)
  if (filters.dateAfter) {
    parts.push(`after:${filters.dateAfter}`);
  }
  
  // Date before
  if (filters.dateBefore) {
    parts.push(`before:${filters.dateBefore}`);
  }
  
  // Has attachment
  if (filters.hasAttachment) {
    parts.push('has:attachment');
  }
  
  // Is unread
  if (filters.isUnread) {
    parts.push('is:unread');
  }
  
  // Is starred
  if (filters.isStarred) {
    parts.push('is:starred');
  }
  
  // Label
  if (filters.label?.trim()) {
    parts.push(`label:${filters.label.trim()}`);
  }
  
  return parts.join(' ');
}

/**
 * Get the query string from a SearchQuery object
 * Handles both filter-based and raw queries
 */
export function getQueryString(query: SearchQuery): string {
  // Raw query takes precedence
  if (query.rawQuery?.trim()) {
    return query.rawQuery.trim();
  }
  
  // Build from filters
  if (query.filters) {
    return buildGmailQuery(query.filters);
  }
  
  return '';
}

/**
 * Format date for Gmail query (YYYY/MM/DD)
 */
export function formatDateForGmail(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Parse a date string (YYYY-MM-DD) to Gmail format (YYYY/MM/DD)
 */
export function toGmailDateFormat(dateString: string): string {
  return dateString.replace(/-/g, '/');
}

/**
 * Common search presets for quick access
 */
export const SEARCH_PRESETS = {
  unread: { isUnread: true },
  starred: { isStarred: true },
  hasAttachment: { hasAttachment: true },
  lastWeek: () => ({
    dateAfter: formatDateForGmail(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ),
  }),
  lastMonth: () => ({
    dateAfter: formatDateForGmail(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ),
  }),
  last3Months: () => ({
    dateAfter: formatDateForGmail(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ),
  }),
};

/**
 * Validate a raw Gmail query for common issues
 * Returns null if valid, error message if invalid
 */
export function validateQuery(query: string): string | null {
  if (!query.trim()) {
    return 'Query cannot be empty';
  }
  
  // Check for unbalanced quotes
  const quoteCount = (query.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    return 'Unbalanced quotes in query';
  }
  
  // Check for invalid date formats
  const dateMatches = query.match(/(?:after|before):(\S+)/g);
  if (dateMatches) {
    for (const match of dateMatches) {
      const dateStr = match.split(':')[1];
      if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        return `Invalid date format: ${dateStr}. Use YYYY/MM/DD`;
      }
    }
  }
  
  return null;
}

/**
 * Example queries for the help section
 */
export const QUERY_EXAMPLES = [
  {
    query: 'from:boss@company.com',
    description: 'Emails from your boss',
  },
  {
    query: 'to:me is:unread',
    description: 'Unread emails sent to you',
  },
  {
    query: 'subject:invoice after:2024/01/01',
    description: 'Invoices from 2024',
  },
  {
    query: 'has:attachment filename:pdf',
    description: 'Emails with PDF attachments',
  },
  {
    query: '"project update" -draft',
    description: 'Contains exact phrase, excluding drafts',
  },
  {
    query: 'from:@acme.com after:2024/01/01 before:2024/06/01',
    description: 'From ACME domain in H1 2024',
  },
];
