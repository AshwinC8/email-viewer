/**
 * Email Providers
 * 
 * Export all providers and types for easy importing.
 */

// Types
export * from './types';

// Providers
export { GmailProvider, gmailProvider } from './gmail';
export { EmlProvider, parseEmlFile, parseEmlFiles, parseEmlContent } from './eml';
