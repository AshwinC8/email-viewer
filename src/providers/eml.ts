/**
 * EML File Parser
 * 
 * Parses .eml files (RFC 2822 format) into NormalizedEmail format.
 * Handles:
 * - Headers (From, To, Subject, Date, etc.)
 * - Plain text and HTML bodies
 * - Multipart MIME messages
 * - Attachment metadata
 */

import { NormalizedEmail, EmailParticipant, AttachmentMeta } from '../services/types';
import { EmailPreview, EmailProvider, ParsedEmlFile } from './types';

// ============================================
// EML Parser
// ============================================

interface ParsedHeaders {
  [key: string]: string;
}

interface MimePart {
  headers: ParsedHeaders;
  body: string;
  parts?: MimePart[];
}

/**
 * Parse email address string into EmailParticipant
 * Handles formats like:
 * - "John Doe <john@example.com>"
 * - "john@example.com"
 * - "<john@example.com>"
 */
function parseEmailAddress(raw: string): EmailParticipant {
  if (!raw) return { name: '', email: '' };
  
  raw = raw.trim();
  
  // Format: "Name <email>"
  const match = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim().toLowerCase()
    };
  }
  
  // Format: "<email>"
  const bracketMatch = raw.match(/^<([^>]+)>$/);
  if (bracketMatch) {
    return {
      name: '',
      email: bracketMatch[1].trim().toLowerCase()
    };
  }
  
  // Format: just email
  if (raw.includes('@')) {
    return {
      name: '',
      email: raw.toLowerCase()
    };
  }
  
  return { name: raw, email: '' };
}

/**
 * Parse multiple email addresses (comma or semicolon separated)
 */
function parseEmailAddresses(raw: string): EmailParticipant[] {
  if (!raw) return [];
  
  // Split by comma or semicolon, but not inside angle brackets
  const addresses: string[] = [];
  let current = '';
  let inBrackets = false;
  
  for (const char of raw) {
    if (char === '<') inBrackets = true;
    if (char === '>') inBrackets = false;
    
    if ((char === ',' || char === ';') && !inBrackets) {
      if (current.trim()) addresses.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) addresses.push(current.trim());
  
  return addresses.map(parseEmailAddress).filter(p => p.email);
}

/**
 * Parse date string from email header
 */
function parseEmailDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  try {
    // Try standard parsing first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Try removing timezone abbreviation
    const cleaned = dateStr.replace(/\s+\([A-Z]+\)\s*$/, '');
    const cleanedDate = new Date(cleaned);
    if (!isNaN(cleanedDate.getTime())) return cleanedDate;
    
    return new Date();
  } catch {
    return new Date();
  }
}

/**
 * Decode MIME encoded words (=?charset?encoding?text?=)
 */
function decodeMimeWord(text: string): string {
  if (!text) return '';
  
  // Pattern: =?charset?encoding?encoded_text?=
  const pattern = /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi;
  
  return text.replace(pattern, (_match: string, _charset: string, encoding: string, encoded: string) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        // Base64
        return atob(encoded);
      } else if (encoding.toUpperCase() === 'Q') {
        // Quoted-printable
        return encoded
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) => 
            String.fromCharCode(parseInt(hex, 16))
          );
      }
    } catch {
      return encoded;
    }
    return encoded;
  });
}

/**
 * Decode quoted-printable body
 */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // Soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );
}

/**
 * Decode base64 body
 */
function decodeBase64(text: string): string {
  try {
    return atob(text.replace(/\s/g, ''));
  } catch {
    return text;
  }
}

/**
 * Parse EML headers section
 */
function parseHeaders(headerSection: string): ParsedHeaders {
  const headers: ParsedHeaders = {};
  
  // Unfold headers (lines starting with whitespace are continuations)
  const unfolded = headerSection.replace(/\r?\n[ \t]+/g, ' ');
  
  const lines = unfolded.split(/\r?\n/);
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = decodeMimeWord(line.substring(colonIndex + 1).trim());
      headers[key] = value;
    }
  }
  
  return headers;
}

/**
 * Parse MIME multipart body
 */
function parseMultipart(body: string, boundary: string): MimePart[] {
  const parts: MimePart[] = [];
  
  // Split by boundary
  const boundaryPattern = `--${boundary}`;
  const sections = body.split(boundaryPattern);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    
    // Check for end boundary
    if (section.trim().startsWith('--')) break;
    
    // Split headers and body
    const headerBodySplit = section.indexOf('\r\n\r\n');
    const altSplit = section.indexOf('\n\n');
    const splitIndex = headerBodySplit !== -1 ? headerBodySplit : altSplit;
    
    if (splitIndex === -1) continue;
    
    const headerSection = section.substring(0, splitIndex);
    const bodySection = section.substring(splitIndex + (headerBodySplit !== -1 ? 4 : 2));
    
    const headers = parseHeaders(headerSection);
    
    // Check for nested multipart
    const contentType = headers['content-type'] || '';
    const nestedBoundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
    
    if (nestedBoundaryMatch) {
      parts.push({
        headers,
        body: '',
        parts: parseMultipart(bodySection, nestedBoundaryMatch[1])
      });
    } else {
      parts.push({ headers, body: bodySection.trim() });
    }
  }
  
  return parts;
}

/**
 * Extract text and HTML from MIME parts
 */
function extractBodies(parts: MimePart[]): { text: string; html: string } {
  let text = '';
  let html = '';
  
  for (const part of parts) {
    const contentType = (part.headers['content-type'] || '').toLowerCase();
    const encoding = (part.headers['content-transfer-encoding'] || '').toLowerCase();
    
    let body = part.body;
    
    // Decode body
    if (encoding === 'quoted-printable') {
      body = decodeQuotedPrintable(body);
    } else if (encoding === 'base64') {
      body = decodeBase64(body);
    }
    
    if (contentType.includes('text/plain') && !text) {
      text = body;
    } else if (contentType.includes('text/html') && !html) {
      html = body;
    }
    
    // Recurse into nested parts
    if (part.parts) {
      const nested = extractBodies(part.parts);
      if (!text && nested.text) text = nested.text;
      if (!html && nested.html) html = nested.html;
    }
  }
  
  return { text, html };
}

/**
 * Extract attachment metadata from MIME parts
 */
function extractAttachments(parts: MimePart[], attachments: AttachmentMeta[] = []): AttachmentMeta[] {
  for (const part of parts) {
    const contentDisposition = part.headers['content-disposition'] || '';
    const contentType = part.headers['content-type'] || '';
    
    // Check if this is an attachment
    if (contentDisposition.toLowerCase().includes('attachment') ||
        (contentType && !contentType.includes('text/plain') && !contentType.includes('text/html') && !contentType.includes('multipart/'))) {
      
      // Extract filename
      let filename = '';
      const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/i) ||
                           contentType.match(/name="?([^";\n]+)"?/i);
      if (filenameMatch) {
        filename = decodeMimeWord(filenameMatch[1]);
      }
      
      if (filename) {
        attachments.push({
          id: `att_${attachments.length}`,
          filename,
          mimeType: contentType.split(';')[0].trim(),
          size: part.body.length
        });
      }
    }
    
    // Recurse
    if (part.parts) {
      extractAttachments(part.parts, attachments);
    }
  }
  
  return attachments;
}

/**
 * Main EML parsing function
 */
export function parseEmlContent(content: string, filename: string): NormalizedEmail {
  // Split headers and body
  const headerBodySplit = content.indexOf('\r\n\r\n');
  const altSplit = content.indexOf('\n\n');
  const splitIndex = headerBodySplit !== -1 ? headerBodySplit : altSplit;
  
  if (splitIndex === -1) {
    throw new Error('Invalid EML format: no header/body separator found');
  }
  
  const headerSection = content.substring(0, splitIndex);
  const bodySection = content.substring(splitIndex + (headerBodySplit !== -1 ? 4 : 2));
  
  // Parse headers
  const headers = parseHeaders(headerSection);
  
  // Parse body
  let bodyText = '';
  let bodyHtml = '';
  let attachments: AttachmentMeta[] = [];
  
  const contentType = headers['content-type'] || 'text/plain';
  const encoding = headers['content-transfer-encoding'] || '';
  
  // Check for multipart
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
  
  if (boundaryMatch) {
    // Multipart message
    const parts = parseMultipart(bodySection, boundaryMatch[1]);
    const bodies = extractBodies(parts);
    bodyText = bodies.text;
    bodyHtml = bodies.html;
    attachments = extractAttachments(parts);
  } else {
    // Simple message
    let body = bodySection;
    
    if (encoding.toLowerCase() === 'quoted-printable') {
      body = decodeQuotedPrintable(body);
    } else if (encoding.toLowerCase() === 'base64') {
      body = decodeBase64(body);
    }
    
    if (contentType.includes('text/html')) {
      bodyHtml = body;
    } else {
      bodyText = body;
    }
  }
  
  // Generate ID from Message-ID or filename
  const messageId = headers['message-id']?.replace(/[<>]/g, '') || '';
  const id = messageId || `eml_${Date.now()}_${filename.replace(/[^a-z0-9]/gi, '_')}`;
  
  // Parse date
  const date = parseEmailDate(headers['date']);
  
  // Parse from
  const from = parseEmailAddress(headers['from']);
  
  // Parse recipients
  const to = parseEmailAddresses(headers['to']);
  const cc = parseEmailAddresses(headers['cc']);
  const bcc = parseEmailAddresses(headers['bcc']);
  
  // Subject
  const subject = headers['subject'] || '(No Subject)';
  
  // Create snippet
  const snippet = (bodyText || bodyHtml.replace(/<[^>]*>/g, ''))
    .substring(0, 150)
    .replace(/\s+/g, ' ')
    .trim();
  
  // Threading headers
  const inReplyTo = headers['in-reply-to']?.replace(/[<>]/g, '') || null;
  const references = (headers['references'] || '')
    .split(/\s+/)
    .map(r => r.replace(/[<>]/g, ''))
    .filter(Boolean);
  
  return {
    id,
    threadId: inReplyTo || messageId || id, // Group by reply-to or self
    from,
    to,
    cc,
    bcc,
    subject,
    snippet,
    bodyText,
    bodyHtml,
    date: date.toISOString(),
    internalDate: date.getTime(),
    labels: ['EML'],
    isUnread: false,
    isStarred: false,
    messageId: messageId || null,
    inReplyTo,
    references,
    hasAttachments: attachments.length > 0,
    attachments
  };
}

/**
 * Parse EML file from File object
 */
export async function parseEmlFile(file: File): Promise<ParsedEmlFile> {
  const content = await file.text();
  const email = parseEmlContent(content, file.name);
  
  const preview: EmailPreview = {
    id: email.id,
    threadId: email.threadId,
    from: email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email,
    to: email.to.map(p => p.email),
    subject: email.subject,
    snippet: email.snippet,
    date: new Date(email.date),
    hasAttachments: email.hasAttachments,
    isUnread: email.isUnread,
    source: 'eml'
  };
  
  return {
    filename: file.name,
    email,
    preview
  };
}

/**
 * Parse multiple EML files
 */
export async function parseEmlFiles(files: FileList | File[]): Promise<ParsedEmlFile[]> {
  const results: ParsedEmlFile[] = [];
  
  for (const file of Array.from(files)) {
    if (file.name.toLowerCase().endsWith('.eml')) {
      try {
        const parsed = await parseEmlFile(file);
        results.push(parsed);
      } catch (error) {
        console.error(`Failed to parse ${file.name}:`, error);
      }
    }
  }
  
  return results;
}

// ============================================
// EML Provider Implementation
// ============================================

/**
 * EML Provider - stores parsed files in memory
 */
export class EmlProvider implements EmailProvider {
  type: 'eml' = 'eml';
  name = 'EML Files';
  icon = 'FileText';
  
  private parsedFiles: Map<string, ParsedEmlFile> = new Map();
  
  /**
   * Load EML files into the provider
   */
  async loadFiles(files: FileList | File[]): Promise<EmailPreview[]> {
    const parsed = await parseEmlFiles(files);
    
    for (const file of parsed) {
      this.parsedFiles.set(file.email.id, file);
    }
    
    return parsed.map(f => f.preview);
  }
  
  /**
   * Get all loaded previews
   */
  getAllPreviews(): EmailPreview[] {
    return Array.from(this.parsedFiles.values()).map(f => f.preview);
  }
  
  /**
   * Search loaded EML files (fuzzy search)
   */
  async search(query: string): Promise<EmailPreview[]> {
    const all = this.getAllPreviews();
    
    if (!query.trim()) return all;
    
    const lowerQuery = query.toLowerCase();
    
    return all.filter(preview => {
      return (
        preview.from.toLowerCase().includes(lowerQuery) ||
        preview.subject.toLowerCase().includes(lowerQuery) ||
        preview.snippet.toLowerCase().includes(lowerQuery) ||
        preview.to.some(t => t.toLowerCase().includes(lowerQuery))
      );
    });
  }
  
  /**
   * Fetch full email content for selected IDs
   */
  async fetchFull(ids: string[]): Promise<NormalizedEmail[]> {
    return ids
      .map(id => this.parsedFiles.get(id)?.email)
      .filter((email): email is NormalizedEmail => email !== undefined);
  }
  
  /**
   * Check if provider has any files loaded
   */
  isReady(): boolean {
    return this.parsedFiles.size > 0;
  }
  
  /**
   * Clear all loaded files
   */
  clear(): void {
    this.parsedFiles.clear();
  }
  
  /**
   * Get count of loaded files
   */
  get fileCount(): number {
    return this.parsedFiles.size;
  }
}
