/**
 * Ooloor Email Viewer
 * 
 * Main application component.
 * 
 * Flow:
 * 1. Dashboard shows imported emails (from session storage)
 * 2. "Import Emails" button opens modal
 * 3. Modal allows Gmail search or EML upload
 * 4. Selected emails are imported to project
 * 5. Click thread to view conversation
 */

import { useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  Plus,
  Mail,
  FileText,
  Trash2,
  ArrowLeft,
  LogOut,
  Inbox
} from 'lucide-react';
import { format } from 'date-fns';

// Components
import { GoogleAuth } from './components/Auth/GoogleAuth';
import { ImportModal } from './components/ImportModal/ImportModal';
import { ThreadView } from './components/ThreadView/ThreadView';

// Store
import {
  useAuthStore,
  useProjectStore,
  useUIStore,
  useSelectedThread,
  useProjectStats
} from './store';

// Types
import { NormalizedEmail, EmailThread } from './services/types';

// ============================================
// Config
// ============================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// ============================================
// Main App
// ============================================

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gray-100">
        <Dashboard />
      </div>
    </GoogleOAuthProvider>
  );
}

// ============================================
// Dashboard Component
// ============================================

function Dashboard() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { threads, selectThread, clearAll } = useProjectStore();
  const { isImportModalOpen, openImportModal, closeImportModal, activeView, setActiveView } = useUIStore();
  const selectedThread = useSelectedThread();
  const stats = useProjectStats();
  
  const handleImport = useCallback((emails: NormalizedEmail[]) => {
    useProjectStore.getState().importEmails(emails);
  }, []);
  
  const handleSelectThread = useCallback((thread: EmailThread) => {
    selectThread(thread.threadId);
    setActiveView('thread');
  }, [selectThread, setActiveView]);
  
  const handleBackToList = useCallback(() => {
    selectThread(null);
    setActiveView('list');
  }, [selectThread, setActiveView]);
  
  // Mobile: Show either list or thread
  const showThread = activeView === 'thread' && selectedThread;
  
  return (
    <>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              {showThread && (
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl font-semibold text-gray-900">
                Ooloor
              </h1>
              <span className="hidden sm:inline text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Email Viewer
              </span>
            </div>
            
            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Stats */}
              {stats.totalEmails > 0 && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                  <span>{stats.totalThreads} threads</span>
                  <span>{stats.totalEmails} emails</span>
                </div>
              )}
              
              {/* Auth */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <img
                    src={user?.picture}
                    alt={user?.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <button
                    onClick={logout}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <GoogleAuth />
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="h-[calc(100vh-4rem)] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-full max-w-[1600px] mx-auto">
          {threads.length === 0 ? (
            /* Empty State - Full Width */
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-medium text-gray-900">
                  Imported Emails
                </h2>
                <button
                  onClick={openImportModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Import Emails
                </button>
              </div>
              <div className="flex-1">
                <EmptyState onImport={openImportModal} />
              </div>
            </div>
          ) : (
            /* Split View - List + Thread */
            <div className="flex gap-6 h-full">
              {/* Email List - Fixed width on desktop, full screen on mobile */}
              <div className={`
                ${showThread ? 'hidden md:flex' : 'flex'}
                flex-col
                w-full md:w-[400px] lg:w-[420px]
                flex-shrink-0
              `}>
                {/* Actions Bar */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h2 className="text-lg font-medium text-gray-900">
                    Imported Emails
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (confirm('Clear all imported emails?')) {
                          clearAll();
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Clear All</span>
                    </button>
                    <button
                      onClick={openImportModal}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Import Emails
                    </button>
                  </div>
                </div>

                {/* Thread List - Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  <div className="bg-white rounded-xl shadow-sm border divide-y">
                    {threads.map((thread) => (
                      <ThreadRow
                        key={thread.threadId}
                        thread={thread}
                        isSelected={thread.threadId === selectedThread?.threadId}
                        onClick={() => handleSelectThread(thread)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Thread View - Takes remaining space on desktop, full screen on mobile */}
              {selectedThread && (
                <div className={`
                  ${showThread ? 'flex' : 'hidden md:flex'}
                  flex-col
                  flex-1
                  min-w-0
                `}>
                  <div className="bg-white rounded-xl shadow-sm border h-full overflow-hidden">
                    <ThreadView
                      thread={selectedThread}
                      onClose={handleBackToList}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        onImport={handleImport}
      />
    </>
  );
}

// ============================================
// Thread Row Component
// ============================================

interface ThreadRowProps {
  thread: EmailThread;
  isSelected: boolean;
  onClick: () => void;
}

function ThreadRow({ thread, isSelected, onClick }: ThreadRowProps) {
  const isEml = thread.labels.includes('EML');
  
  // Format date smartly
  const date = new Date(thread.lastMessageDate);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === new Date(now.getTime() - 86400000).toDateString();
  
  let dateStr: string;
  if (isToday) {
    dateStr = format(date, 'h:mm a');
  } else if (isYesterday) {
    dateStr = 'Yesterday';
  } else if (date.getFullYear() === now.getFullYear()) {
    dateStr = format(date, 'MMM d');
  } else {
    dateStr = format(date, 'MMM d, yyyy');
  }
  
  // Get display name from first sender
  const sender = thread.participants[0];
  const displayName = sender?.name || sender?.email?.split('@')[0] || 'Unknown';
  
  return (
    <div
      onClick={onClick}
      className={`
        px-4 py-3.5 cursor-pointer transition-all duration-200 ease-in-out
        border-l-4
        ${isSelected
          ? 'bg-blue-50/80 border-l-blue-600'
          : 'border-l-transparent hover:bg-gray-50/80 hover:border-l-gray-300'
        }
      `}
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar / Icon */}
        <div className={`
          w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
          transition-transform duration-200
          ${isSelected ? 'scale-105' : ''}
          ${isEml ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}
        `}>
          {isEml ? (
            <FileText className="w-5 h-5" />
          ) : (
            <span className="text-sm font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Sender and Date */}
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`font-semibold truncate ${
                thread.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
              }`}>
                {displayName}
              </span>
              {thread.messageCount > 1 && (
                <span className="text-xs text-gray-600 bg-gray-200/70 px-2 py-0.5 rounded-full font-medium">
                  {thread.messageCount}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0 font-medium">
              {dateStr}
            </span>
          </div>

          {/* Subject */}
          <div className={`text-sm truncate mb-1.5 leading-tight ${
            thread.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
          }`}>
            {thread.subject}
          </div>

          {/* Snippet */}
          <div className="text-sm text-gray-500 truncate leading-tight">
            {thread.snippet}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  onImport: () => void;
}

function EmptyState({ onImport }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Inbox className="w-8 h-8 text-gray-400" />
      </div>
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No emails imported yet
      </h3>
      
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Import emails from Gmail or upload .eml files to get started.
        Your imported emails will appear here.
      </p>
      
      <button
        onClick={onImport}
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <Plus className="w-5 h-5" />
        Import Emails
      </button>
      
      <div className="mt-8 pt-8 border-t">
        <p className="text-sm text-gray-500 mb-4">Supported sources:</p>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="w-5 h-5 text-blue-500" />
            <span>Gmail</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <FileText className="w-5 h-5 text-amber-500" />
            <span>.eml files</span>
          </div>
        </div>
      </div>
    </div>
  );
}
