# Pending Tasks for Prompt Sanitizer Extension

This document outlines the remaining work required to make the **Prompt Sanitizer** extension fully functional and ready for the Chrome Web Store.

## 1. Core Functionality Gaps

### ✅ Implement Auto-Sanitization on Submit (COMPLETED)

**Status**: Completed on 2026-01-01

The extension now supports auto-sanitization on submit. The **Auto-sanitize** setting (in `Settings.tsx`) is now fully functional.

**Implementation Details**:
- Modified `src/content/index.tsx` to intercept message submission
- Uses `handler.getSubmitButton()` to attach event listeners
- Listens for `click` on submit button
- If `settings.autoSanitize` is true:
  1. Prevents default submission with `preventDefault()` / `stopPropagation()`
  2. Runs `sanitize()` on input text
  3. If changes found, shows preview modal for confirmation
  4. Updates input value and triggers submit programmatically
  5. Uses `isAutoSanitizing` flag to avoid infinite loops
- **Also implemented**: Support for `Cmd+Enter` (Mac) and `Ctrl+Enter` (Windows) keyboard shortcuts
- Listeners are re-attached when settings change via storage subscription
- Uses MutationObserver to watch for submit button appearance in SPA navigation

**Note**: React/SPA sites handle programmatic clicks properly since `BaseSiteHandler.setInputText` already dispatches proper `input` events to update the underlying state. Testing on live sites recommended.

### Site-Specific Selector Verification

Selectors in `src/content/sites/*.ts` are based on best-guess or common knowledge. They may be outdated.

- **Task**: Verify selectors on live sites.
- **ChatGPT (`src/content/sites/chatgpt.ts`)**:
  - Verify `#prompt-textarea`.
  - Verify send button `data-testid="send-button"`.
- **Claude (`src/content/sites/claude.ts`)**:
  - Verify contenteditable div structure.
  - Verify send button `aria-label`.
- **Gemini (`src/content/sites/gemini.ts`)**:
  - Verify `rich-textarea` and input container.

### Keyboard Shortcuts

- **Task**: Add support for `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows) interception if Auto-sanitize is on.
- Users often submit via keyboard. The current implementation only watches for clicks if updated, but keyboard listeners on the textarea are needed.

## 2. Infrastructure & Persistence

### Cloud Sync (Future Proofing)

- **Task**: The `types.ts` has `SyncMetadata`, but `storage.ts` currently only uses `chrome.storage.local`.
- **Next Step**: No immediate action needed for v1.0, but keep purely local for now to respect privacy.

### Rule Import/Export Refinement

- **Task**: Verify the `Settings.tsx` import/export logic handles edge cases (invalid JSON, duplicate IDs).

## 3. UI/UX Refinements

### Overlay Positioning & Z-Index

- **Task**: Test the "🛡️ Sanitize" button overlay on all sites.
- **Potential Issue**: It might overlap with site native buttons (e.g., file upload, voice input).
- **Fix**: Adjust `positionOverlay()` in `src/content/index.tsx` to be smarter or allow user dragging.

### Dark Mode Sync

- **Task**: Ensure the Shadow DOM styles (`getOverlayStyles`) respect the user's preference from `Settings.tsx`. currently acts on `prefers-color-scheme` media query, but should probably listen to the extension's explicit theme setting if set to 'dark' or 'light'.

## 4. Testing & QA

### Cross-Browser Testing

- **Task**: Test in Edge (Chromium) and potentially Firefox.
- **Firefox**: Manifest v3 support in Firefox is good but may require `background.scripts` instead of `service_worker` key adjustments or polyfills.

### Security Review

- **Task**: Ensure `sanitize()` regex engine doesn't cause ReDoS (Regular Expression Denise of Service) with complex user patterns.
- **Mitigation**: We already use a simple loop, but maybe limit input length or regex execution time.

## 5. Publishing Preparation

### Packaging

- **Task**: Create a `release` script in `package.json`.
- `zip -r extension.zip dist/*`

### Store Assets

- **Task**: Generate promo tiles (440x280, 1280x800) and screenshots.
- **Descriptions**: Write a privacy policy explaining that data is processed locally (no data sent to cloud).

## 6. Known Issues / Bugs to Check

- **SPA Navigation**: When navigating between chats (e.g., New Chat -> History), does the content script re-inject or detecting the new textarea?
- **Current Logic**: `init()` runs once. We likely need a `MutationObserver` on the `body` or URL change listener to re-initialize `handler` if the textarea node is destroyed and recreated (common in React apps). `BaseSiteHandler` has `waitForElement`, but the main `init` flow might need a robust "watch for navigation" loop.

## Codebase Map

- **Manifest**: `manifest.json`
- **Build Config**: `vite.config.ts` (Manual multi-entry build)
- **Content Script Entry**: `src/content/index.tsx`
- **Site Handlers**: `src/content/sites/`
- **Popup UI**: `src/popup/`
- **Core Logic**: `src/shared/`
