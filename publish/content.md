## Reviewer Instructions:

The extension help to detect, mask private data based on custom defined rules.

1. Install extension, defined / load pre-defined rules.
2. Go to support website: chatgpt.com, gemini.google.com, claude.ai, huggingface.co/chat
3. Type message with text matchin the defined rules.
4. Extension overlay will help you detect and mask the data.

## Single Purpose Description:

Maskeraid helps users protect their privacy by automatically masking or replacing sensitive information (such as email addresses, phone numbers, credit card numbers, Social Security Numbers) in text inputs before sending prompts to Large Language Model websites like ChatGPT, Claude, and Gemini. Users create custom replacement rules using regex patterns or plain text strings, and the extension applies these rules in real-time on supported LLM platforms. The extension provides a preview showing how text will be transformed before submission, and all rules and settings are stored locally in the user's browser.

---

## Additional Form Fields for Chrome Web Store:

Detailed Description (132 characters max for short version):
Detect and mask PII data before sending to LLMs like ChatGPT, Claude, and Gemini.
Full Description:
Protect your privacy when using AI chat tools. Maskeraid automatically sanitizes sensitive information from your prompts before sending them to Large Language Models.
Create custom rules to mask emails, phone numbers, credit cards, SSNs, or any personal data using regex or plain text patterns. Works seamlessly on ChatGPT, Claude, Gemini, HuggingFace, Perplexity, Notion, Microsoft Copilot, and Bing.
Features:

- Custom regex and string replacement rules
- Real-time preview of masked text
- Multi-site support
- Dark mode support
- Local storage (no data sent to external servers)
  Category: Productivity (or Privacy & Security)
  Language: English

## Firefox Add-on Submission:

Summary:
Detect and mask PII data before sending to LLMs like ChatGPT, Claude, and Gemini.

Description:
Protect your privacy when using AI chat tools. Maskeraid automatically sanitizes sensitive information from your prompts before sending them to Large Language Models. Create custom rules to mask emails, phone numbers, credit cards, SSNs, or any personal data using regex or plain text patterns. Works seamlessly on ChatGPT, Claude, Gemini, HuggingFace, Perplexity, Notion, Microsoft Copilot, and Bing.

Features:

- Custom regex and string replacement rules
- Real-time preview of masked text
- Multi-site support
- Dark mode support
- Local storage (no data sent to external servers)

Category: Privacy & Security
License: MPL-2.0

## Technical Details:

Maskeraid is built as a modern browser extension using React 19, TypeScript, Vite, and Tailwind CSS v4. The extension follows a modular architecture with clear separation of concerns:

### Core Components:

- **Background Service Worker** (`src/background/`): Handles cross-context messaging and manages extension state
- **Content Scripts** (`src/content/`): Injected into LLM websites to detect text inputs and apply sanitization rules
- **Site Handlers** (`src/content/sites/`): Abstract base class with concrete implementations for ChatGPT, Claude, Gemini, HuggingFace, Perplexity, Notion, Microsoft Copilot, and Bing
- **Popup UI** (`src/popup/`): React-based interface for managing rules, settings, and viewing masked content

### Technical Stack:

- **Frontend**: React 19 with TypeScript for type safety
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS v4 with dark mode support
- **Storage**: Chrome Storage API with localStorage fallback for development
- **Pattern Matching**: Native JavaScript RegExp for regex rules
- **DOM Manipulation**: MutationObserver for reactive content script behavior
- **Style Isolation**: Shadow DOM (closed mode) to prevent CSS conflicts

### Data Flow:

1. User creates rules in popup UI → stored in local storage
2. Content script detects text area on LLM site → applies registered rules
3. Real-time preview shows masked text in overlay before submission
4. User can review and modify masking before sending prompt to LLM
5. All operations performed client-side; no external API calls

### Privacy & Security:

- All rules and settings stored locally in browser
- No telemetry or analytics collection
- No external network requests
- Shadow DOM isolates extension styles from host page
- Content scripts only run on explicitly listed LLM domains

## Developer Comments:

This extension is designed to protect user privacy by sanitizing PII before sending prompts to LLM services. The architecture prioritizes user control and transparency.

### Testing Instructions:

1. Install the extension and open the popup
2. Create a sample rule (e.g., regex: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b` replacement: `***@***.***`)
3. Navigate to any supported site (ChatGPT, Claude, Gemini, etc.)
4. Type text containing an email address in the input field
5. Observe the real-time preview showing masked email
6. Toggle the rule on/off to verify dynamic behavior

### Implementation Notes:

- Site-specific handlers ensure compatibility with each LLM's DOM structure
- Debounced input handling (300ms) provides responsive performance
- Regex patterns are validated before storage to prevent runtime errors
- Fallback mechanisms handle cases where extension context becomes invalid
- The extension gracefully degrades if content script injection fails

### Open Source:

Source code available on GitHub. Contributions welcome. Built with modern web standards and follows extension development best practices.

## Permission Justifications:

1. Storage Permission
   Storage permission is required to save user preferences and custom sanitization rules locally in the browser. This includes:

- Custom replacement rules (regex patterns and replacement text)
- Enabled/disabled status for each rule
- Extension settings (auto-sanitization toggle, overlay visibility, theme preference, enabled sites)
  All data is stored locally using chrome.storage.local and never transmitted to external servers. This allows users to maintain their privacy protection configuration across browser sessions.

2. Active Tab Permission
   Active tab permission enables the extension to interact with the current tab to inject content scripts and sanitize text inputs on LLM websites. The extension needs this to:

- Access text area contents on supported LLM sites to detect and mask sensitive data
- Inject a preview overlay showing the sanitized text before submission
- Apply user-configured rules to text in real-time
  The extension only interacts with tabs on supported LLM domains (listed in host permissions) and does not access or modify content on other websites.

3. Host Permissions
   Host permissions allow the extension to function on specific Large Language Model websites where users input prompts. The extension needs access to:

- Read and modify text area contents to apply sanitization rules
- Inject content scripts that detect input fields and display preview overlays
- Interact with page elements to integrate the masking functionality seamlessly
  Supported domains are strictly limited to LLM and AI chat platforms where users typically share prompts: chat.openai.com, chatgpt.com, claude.ai, gemini.google.com, huggingface.co, perplexity.ai, notion.so, copilot.microsoft.com, and bing.com. No access is requested for general web browsing or unrelated websites.
