/**
 * Thread View Component
 * 
 * Displays a full email thread/conversation.
 * Shows all messages in chronological order with:
 * - Sender info
 * - Timestamp
 * - Full body content
 * - Reply/forward indicators
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  X,
  ChevronDown,
  ChevronUp,
  Mail,
  Reply,
  Paperclip,
  Star,
  Clock,
  Users,
  FileText,
} from 'lucide-react';
import { NormalizedEmail, EmailThread, EmailParticipant } from '../../services/types';

// ============================================
// Thread View Container
// ============================================

interface ThreadViewProps {
  thread: EmailThread;
  onClose: () => void;
}

export function ThreadView({ thread, onClose }: ThreadViewProps) {
  return (
    <div className="flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <ThreadHeader thread={thread} onClose={onClose} />
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.map((message, index) => (
          <MessageCard
            key={message.id}
            message={message}
            isFirst={index === 0}
            isLast={index === thread.messages.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Thread Header
// ============================================

interface ThreadHeaderProps {
  thread: EmailThread;
  onClose: () => void;
}

function ThreadHeader({ thread, onClose }: ThreadHeaderProps) {
  const isEml = thread.labels.includes('EML');
  
  return (
    <div className="border-b border-gray-200 px-4 py-3">
      {/* Subject and close */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isEml ? (
            <FileText className="w-5 h-5 text-amber-500 flex-shrink-0" />
          ) : (
            <Mail className="w-5 h-5 text-blue-500 flex-shrink-0" />
          )}
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {thread.subject}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      {/* Thread metadata */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Mail className="w-4 h-4" />
          {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          {thread.participants.length} {thread.participants.length === 1 ? 'participant' : 'participants'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {thread.messageCount === 1 
            ? format(new Date(thread.firstMessageDate), 'MMM d, yyyy')
            : `${format(new Date(thread.firstMessageDate), 'MMM d')} - ${format(new Date(thread.lastMessageDate), 'MMM d, yyyy')}`
          }
        </span>
      </div>
    </div>
  );
}

// ============================================
// Message Card
// ============================================

interface MessageCardProps {
  message: NormalizedEmail;
  isFirst: boolean;
  isLast: boolean;
}

function MessageCard({ message, isFirst, isLast }: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(isLast); // Auto-expand last message
  const [showFullHeaders, setShowFullHeaders] = useState(false);
  
  const initials = getInitials(message.from);
  const isReply = !!message.inReplyTo;
  const isEml = message.labels.includes('EML');
  
  // Determine which body to show
  const bodyContent = message.bodyHtml || message.bodyText;
  const isHtml = !!message.bodyHtml;
  
  return (
    <div
      className={`border rounded-lg ${
        isLast ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Message Header (always visible) */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
      >
        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isEml 
              ? 'bg-amber-100 text-amber-600'
              : message.isUnread 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-600'
          }`}
        >
          {isEml ? (
            <FileText className="w-5 h-5" />
          ) : (
            <span className="text-sm font-medium">{initials}</span>
          )}
        </div>
        
        {/* Header content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">
                {getDisplayName(message.from)}
              </span>
              {isReply && (
                <Reply className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              {message.isStarred && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {message.hasAttachments && (
                <Paperclip className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-500">
                {format(new Date(message.date), 'MMM d, h:mm a')}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
          
          {/* Preview when collapsed */}
          {!isExpanded && (
            <div className="text-sm text-gray-500 truncate mt-1">
              {message.snippet}
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Full Headers Toggle */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullHeaders(!showFullHeaders);
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showFullHeaders ? 'Hide details' : 'Show details'}
            </button>
            
            {showFullHeaders && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">From:</span>{' '}
                  {message.from.name ? `${message.from.name} <${message.from.email}>` : message.from.email}
                </div>
                <div>
                  <span className="font-medium">To:</span>{' '}
                  {formatRecipients(message.to)}
                </div>
                {message.cc.length > 0 && (
                  <div>
                    <span className="font-medium">CC:</span>{' '}
                    {formatRecipients(message.cc)}
                  </div>
                )}
                <div>
                  <span className="font-medium">Date:</span>{' '}
                  {format(new Date(message.date), 'EEEE, MMMM d, yyyy at h:mm:ss a')}
                </div>
                <div>
                  <span className="font-medium">Subject:</span> {message.subject}
                </div>
                {message.messageId && (
                  <div className="truncate">
                    <span className="font-medium">Message-ID:</span>{' '}
                    <code className="text-xs">{message.messageId}</code>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Message Body */}
          <div className="p-4">
            {isHtml ? (
              <div
                className="prose prose-sm max-w-none email-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyContent) }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                {bodyContent}
              </pre>
            )}
          </div>
          
          {/* Attachments */}
          {message.hasAttachments && message.attachments.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">
                Attachments ({message.attachments.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{att.filename}</span>
                    <span className="text-gray-400 text-xs">
                      {formatFileSize(att.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getInitials(participant: EmailParticipant): string {
  if (participant.name) {
    const parts = participant.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.substring(0, 2).toUpperCase() || '?';
  }
  return participant.email?.substring(0, 2).toUpperCase() || '?';
}

function getDisplayName(participant: EmailParticipant): string {
  return participant.name || participant.email || 'Unknown';
}

function formatRecipients(recipients: EmailParticipant[]): string {
  return recipients
    .map((r) => (r.name ? `${r.name} <${r.email}>` : r.email))
    .join(', ');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Basic HTML sanitization
 * In production, use a proper library like DOMPurify
 */
function sanitizeHtml(html: string): string {
  // Remove script tags
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  clean = clean.replace(/\son\w+="[^"]*"/gi, '');
  clean = clean.replace(/\son\w+='[^']*'/gi, '');
  
  // Remove javascript: URLs
  clean = clean.replace(/href="javascript:[^"]*"/gi, 'href="#"');
  
  return clean;
}

export default ThreadView;
