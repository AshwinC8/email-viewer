# Ooloor Email Viewer - Claude Code Context

## Project Overview

This is a React email viewer component for **Ooloor**, an AI-powered legal timeline platform. The component allows users to import emails from multiple sources (Gmail OAuth, EML files) into projects.

## Architecture

### Provider Pattern
Multi-provider architecture in `/src/providers/`:
- `types.ts` - EmailProvider interface, EmailPreview type, fuzzy search utilities
- `gmail.ts` - GmailProvider (OAuth, Gmail API)
- `eml.ts` - EmlProvider (RFC 2822 parser, MIME handling)
- `index.ts` - Exports

### State Management (Zustand)
`/src/store/index.ts`:
- `AuthStore` - Google OAuth state (accessToken, user info)
- `ProjectStore` - Imported emails, threads, persistence to sessionStorage
- `UIStore` - Modal state, mobile view

### Key Components
- `App.tsx` - Main dashboard, shows imported emails
- `ImportModal/ImportModal.tsx` - Tabbed modal for Gmail/EML import
- `ThreadView/ThreadView.tsx` - Email thread display
- `Auth/GoogleAuth.tsx` - OAuth button/profile

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state)
- date-fns
- lucide-react (icons)

## Current Features
✅ Gmail OAuth import (search + select)
✅ EML file upload (drag & drop, multi-select)
✅ Fuzzy search across from/subject/snippet
✅ Thread building from imported emails
✅ Session storage persistence
✅ Responsive mobile UI

## Development
```bash
npm install
cp .env.example .env  # Add VITE_GOOGLE_CLIENT_ID
npm run dev
```

## Next Steps / TODO
- [ ] Add Outlook provider (Microsoft Graph API)
- [ ] Integrate with Ooloor backend API for persistence
- [ ] Add timeline visualization
- [ ] AI summarization integration
- [ ] Export functionality (PDF/DOCX)

## Related Ooloor Docs
See project files for full context:
- PRD: `Ooloor_PRD.md`
- Technical Scope: `ooloor-technical-scope.md`
- Instruction Framework: `Instruction_Framework_Ooloor_V1.docx`
- Output Expectations: `Ooloor_output_expectations.docx`

## Transcript History
Full development conversation available at:
`/mnt/transcripts/2026-01-13-22-21-26-gmail-eml-provider-refactor.txt`
