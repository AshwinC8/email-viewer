/**
 * Import Modal
 * 
 * Modal for importing emails from various sources:
 * - Gmail (OAuth search)
 * - EML files (drag & drop upload)
 * 
 * Features:
 * - Tab-based source selection
 * - Fuzzy search across from, subject, snippet
 * - Multi-select with Select All
 * - Import selected emails to project
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Mail,
  FileText,
  Upload,
  Check,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  Paperclip,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { EmailPreview, fuzzySearchEmails, EmlProvider } from '../../providers';
import { gmailProvider } from '../../providers/gmail';
import { NormalizedEmail } from '../../services/types';
import { useAuthStore } from '../../store';

// ============================================
// Types
// ============================================

type SourceTab = 'gmail' | 'eml';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (emails: NormalizedEmail[]) => void;
}

// ============================================
// Component
// ============================================

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  // Auth state for Gmail
  const { accessToken } = useAuthStore();
  
  // Local state
  const [activeTab, setActiveTab] = useState<SourceTab>('gmail');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<EmailPreview[]>([]);
  const [filteredResults, setFilteredResults] = useState<EmailPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // EML provider instance
  const emlProviderRef = useRef(new EmlProvider());
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Search debounce timer
  const searchTimerRef = useRef<number | undefined>(undefined);
  
  // ============================================
  // Gmail Search
  // ============================================
  
  const searchGmail = useCallback(async (query: string) => {
    if (!accessToken) {
      setError('Please connect your Gmail account first');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      gmailProvider.setAccessToken(accessToken);
      const previews = await gmailProvider.search(query);
      setResults(previews);
      setFilteredResults(previews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setFilteredResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [accessToken]);
  
  // ============================================
  // EML File Handling
  // ============================================
  
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setIsSearching(true);
    setError(null);
    
    try {
      const previews = await emlProviderRef.current.loadFiles(files);
      const allPreviews = emlProviderRef.current.getAllPreviews();
      setResults(allPreviews);
      setFilteredResults(allPreviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse files');
    } finally {
      setIsSearching(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  // ============================================
  // Search with Debounce
  // ============================================
  
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    if (activeTab === 'gmail') {
      // Debounce Gmail search
      searchTimerRef.current = window.setTimeout(() => {
        searchGmail(searchQuery);
      }, 300);
    } else {
      // Instant fuzzy search for EML (already loaded)
      if (searchQuery.trim()) {
        const filtered = fuzzySearchEmails(results, searchQuery);
        setFilteredResults(filtered);
      } else {
        setFilteredResults(results);
      }
    }
    
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, activeTab, searchGmail]);
  
  // ============================================
  // Selection
  // ============================================
  
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map(r => r.id)));
    }
  }, [filteredResults, selectedIds.size]);
  
  // ============================================
  // Import
  // ============================================
  
  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    setIsImporting(true);
    setError(null);
    
    try {
      const ids = Array.from(selectedIds);
      let emails: NormalizedEmail[];
      
      if (activeTab === 'gmail') {
        emails = await gmailProvider.fetchFull(ids);
      } else {
        emails = await emlProviderRef.current.fetchFull(ids);
      }
      
      onImport(emails);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [selectedIds, activeTab, onImport, onClose]);
  
  // ============================================
  // Tab Change
  // ============================================
  
  const handleTabChange = useCallback((tab: SourceTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setResults([]);
    setFilteredResults([]);
    setSelectedIds(new Set());
    setError(null);
    
    // Load initial Gmail results
    if (tab === 'gmail' && accessToken) {
      searchGmail('');
    }
  }, [accessToken, searchGmail]);
  
  // Load Gmail on mount if authenticated
  useEffect(() => {
    if (isOpen && activeTab === 'gmail' && accessToken && results.length === 0) {
      searchGmail('');
    }
  }, [isOpen, activeTab, accessToken, results.length, searchGmail]);
  
  // ============================================
  // Render
  // ============================================
  
  if (!isOpen) return null;
  
  const allSelected = filteredResults.length > 0 && selectedIds.size === filteredResults.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredResults.length;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">Import Emails</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => handleTabChange('gmail')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'gmail'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            Gmail
          </button>
          <button
            onClick={() => handleTabChange('eml')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'eml'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            EML Files
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Gmail Tab */}
          {activeTab === 'gmail' && (
            <>
              {!accessToken ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Connect your Gmail account to search emails</p>
                    <p className="text-sm text-gray-500">
                      Use the "Connect Gmail" button in the main app first
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Search Input */}
                  <div className="p-4 border-b flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search emails by sender, subject, or content..."
                        className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  
                  {/* Results */}
                  <EmailResultsList
                    results={filteredResults}
                    selectedIds={selectedIds}
                    expandedId={expandedId}
                    onToggleSelect={toggleSelect}
                    onToggleExpand={setExpandedId}
                    isLoading={isSearching}
                  />
                </>
              )}
            </>
          )}
          
          {/* EML Tab */}
          {activeTab === 'eml' && (
            <>
              {/* Upload Area */}
              <div
                className="p-4 border-b flex-shrink-0"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {results.length === 0 ? (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-1">Drag & drop .eml files here</p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".eml"
                      multiple
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search loaded emails..."
                        className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      Add More Files
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".eml"
                      multiple
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
              
              {/* Results */}
              {results.length > 0 && (
                <EmailResultsList
                  results={filteredResults}
                  selectedIds={selectedIds}
                  expandedId={expandedId}
                  onToggleSelect={toggleSelect}
                  onToggleExpand={setExpandedId}
                  isLoading={isSearching}
                />
              )}
            </>
          )}
        </div>
        
        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex-shrink-0">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm break-words">{error}</span>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            {filteredResults.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : someSelected ? (
                  <div className="w-4 h-4 border-2 border-blue-600 rounded bg-blue-600 flex items-center justify-center">
                    <div className="w-2 h-0.5 bg-white" />
                  </div>
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Select All</span>
              </button>
            )}
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {selectedIds.size} of {filteredResults.length} selected
            </span>
          </div>
          
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isImporting}
              className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Email Results List Component
// ============================================

interface EmailResultsListProps {
  results: EmailPreview[];
  selectedIds: Set<string>;
  expandedId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string | null) => void;
  isLoading: boolean;
}

function EmailResultsList({
  results,
  selectedIds,
  expandedId,
  onToggleSelect,
  onToggleExpand,
  isLoading
}: EmailResultsListProps) {
  if (isLoading && results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }
  
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No emails found</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {results.map((email) => {
        const isSelected = selectedIds.has(email.id);
        const isExpanded = expandedId === email.id;
        
        return (
          <div
            key={email.id}
            className={`border-b last:border-b-0 transition-colors ${
              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <div
              className="flex items-start gap-2 sm:gap-3 p-3 cursor-pointer"
              onClick={() => onToggleSelect(email.id)}
            >
              {/* Checkbox */}
              <div className="pt-1 flex-shrink-0">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate text-sm sm:text-base">
                    {email.from}
                  </span>
                  {email.hasAttachments && (
                    <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0 ml-auto">
                    {format(email.date, 'MMM d')}
                  </span>
                </div>
                <div className="text-sm text-gray-900 truncate mb-1">
                  {email.subject || '(No Subject)'}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">
                  {email.snippet}
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t text-sm overflow-hidden">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className="text-gray-500 flex-shrink-0">To:</span>
                        <span className="text-gray-700 truncate">{email.to.join(', ')}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500 flex-shrink-0">Date:</span>
                        <span className="text-gray-700">{format(email.date, 'PPpp')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Expand Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(isExpanded ? null : email.id);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ImportModal;
