/**
 * Gmail Provider
 * 
 * Implements EmailProvider interface for Gmail API.
 * Uses OAuth for authentication and Gmail API for fetching emails.
 */

import { EmailProvider, EmailPreview } from './types';
import { NormalizedEmail, GmailMessageResponse, GmailThreadResponse } from '../services/types';
import { parseGmailMessage, buildThread } from '../utils/emailParser';

// ============================================
// Gmail Provider Implementation
// ============================================

export class GmailProvider implements EmailProvider {
  type: 'gmail' = 'gmail';
  name = 'Gmail';
  icon = 'Mail';
  
  private accessToken: string | null = null;
  private cachedPreviews: Map<string, EmailPreview> = new Map();
  private cachedMessages: Map<string, NormalizedEmail> = new Map();
  
  /**
   * Set the OAuth access token
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (!token) {
      this.cachedPreviews.clear();
      this.cachedMessages.clear();
    }
  }
  
  /**
   * Check if authenticated
   */
  isReady(): boolean {
    return !!this.accessToken;
  }
  
  /**
   * Search Gmail with query and return previews
   * Uses simple query for fuzzy search feel
   */
  async search(query: string): Promise<EmailPreview[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Gmail');
    }
    
    // Build Gmail query - simple text search across from, subject, body
    // Gmail's search is already quite fuzzy/smart
    const gmailQuery = query.trim() || 'in:inbox';
    
    // Search for message IDs
    const searchUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    searchUrl.searchParams.set('q', gmailQuery);
    searchUrl.searchParams.set('maxResults', '50'); // Limit for performance
    
    const searchResponse = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Gmail search failed: ${error}`);
    }
    
    const searchData = await searchResponse.json();
    const messageIds: { id: string; threadId: string }[] = searchData.messages || [];
    
    if (messageIds.length === 0) {
      return [];
    }
    
    // Fetch message metadata for previews
    const previews: EmailPreview[] = [];
    
    // Batch fetch in parallel (max 10 at a time)
    const batchSize = 10;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ id, threadId }) => {
          try {
            // Check cache first
            if (this.cachedPreviews.has(id)) {
              return this.cachedPreviews.get(id)!;
            }
            
            // Fetch with metadata format (faster than full)
            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
            
            const msgResponse = await fetch(msgUrl, {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            
            if (!msgResponse.ok) return null;
            
            const msgData: GmailMessageResponse = await msgResponse.json();
            
            // Extract headers
            const headers = msgData.payload.headers || [];
            const getHeader = (name: string) => 
              headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
            
            const preview: EmailPreview = {
              id: msgData.id,
              threadId: msgData.threadId,
              from: getHeader('From'),
              to: getHeader('To').split(',').map(t => t.trim()).filter(Boolean),
              subject: getHeader('Subject') || '(No Subject)',
              snippet: msgData.snippet || '',
              date: new Date(parseInt(msgData.internalDate)),
              hasAttachments: (msgData.payload.parts || []).some(
                p => p.filename && p.filename.length > 0
              ),
              isUnread: msgData.labelIds?.includes('UNREAD'),
              source: 'gmail'
            };
            
            // Cache it
            this.cachedPreviews.set(id, preview);
            
            return preview;
          } catch (error) {
            console.error(`Failed to fetch message ${id}:`, error);
            return null;
          }
        })
      );
      
      previews.push(...batchResults.filter((p): p is EmailPreview => p !== null));
    }
    
    return previews;
  }
  
  /**
   * Fetch full message content for selected IDs
   * Fetches complete threads for proper threading
   */
  async fetchFull(ids: string[]): Promise<NormalizedEmail[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Gmail');
    }
    
    // Get unique thread IDs from selected message IDs
    const threadIds = new Set<string>();
    for (const id of ids) {
      const preview = this.cachedPreviews.get(id);
      if (preview) {
        threadIds.add(preview.threadId);
      }
    }
    
    // Fetch full threads
    const messages: NormalizedEmail[] = [];
    
    for (const threadId of threadIds) {
      try {
        const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
        
        const response = await fetch(threadUrl, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        
        if (!response.ok) continue;
        
        const threadData: GmailThreadResponse = await response.json();

        // Parse ALL messages in the thread (not just selected ones)
        for (const gmailMsg of threadData.messages) {
          const normalized = parseGmailMessage(gmailMsg);
          messages.push(normalized);
          this.cachedMessages.set(gmailMsg.id, normalized);
        }
      } catch (error) {
        console.error(`Failed to fetch thread ${threadId}:`, error);
      }
    }
    
    return messages;
  }
  
  /**
   * Fetch a complete thread by thread ID
   */
  async fetchThread(threadId: string): Promise<NormalizedEmail[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Gmail');
    }
    
    const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
    
    const response = await fetch(threadUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch thread');
    }
    
    const threadData: GmailThreadResponse = await response.json();
    
    return threadData.messages.map(msg => {
      const normalized = parseGmailMessage(msg);
      this.cachedMessages.set(msg.id, normalized);
      return normalized;
    });
  }
  
  /**
   * Clear caches
   */
  clear(): void {
    this.cachedPreviews.clear();
    this.cachedMessages.clear();
  }
}

// Export singleton instance
export const gmailProvider = new GmailProvider();
