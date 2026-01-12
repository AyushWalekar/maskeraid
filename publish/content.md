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
