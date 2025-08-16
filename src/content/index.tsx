
import { getSiteHandler } from './sites';
import { storage } from '../shared/storage';
import { sanitize } from '../shared/sanitizer';
import type { SanitizationRule, ExtensionSettings } from '../shared/types';
import { CSS_PREFIX, OVERLAY_Z_INDEX } from '../shared/constants';

// State
let rules: SanitizationRule[] = [];
let settings: ExtensionSettings | null = null;
let overlayRoot: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let isAutoSanitizing = false;

/**
 * Initialize the content script
 */
async function init() {
  const handler = getSiteHandler();
  if (!handler) {
    console.log('Prompt Sanitizer: No handler for this site');
    return;
  }

  console.log(`Prompt Sanitizer: Initialized for ${handler.displayName}`);

  // Load rules and settings
  [rules, settings] = await Promise.all([
    storage.getRules(),
    storage.getSettings(),
  ]);

  console.log('Prompt Sanitizer: Settings loaded', settings);

  // Check if this site is enabled
  if (settings && !settings.enabledSites.includes(handler.siteName)) {
    console.log(`Prompt Sanitizer: Disabled for ${handler.displayName}`);
    return;
  }

  // Subscribe to storage changes
  storage.subscribe((changes) => {
    if (changes.rules) {
      rules = changes.rules;
      updateBadge();
    }
    if (changes.settings) {
      settings = changes.settings;
      console.log('Prompt Sanitizer: Settings updated', changes.settings);
      // Re-setup auto-sanitize if setting changed
      if (changes.settings.autoSanitize !== undefined) {
        if (changes.settings.autoSanitize) {
          setupAutoSanitizeOnSubmit(handler);
        }
        // Note: We don't remove listeners when disabled for simplicity
        // They just won't trigger due to the check in listeners
      }
      // Re-create overlay if showOverlay changed
      if (changes.settings.showOverlay !== undefined) {
        if (changes.settings.showOverlay) {
          createOverlay(handler);
        } else {
          if (overlayRoot) {
            overlayRoot.remove();
            overlayRoot = null;
            shadowRoot = null;
          }
        }
      }
    }
  });

  // Initialize handler
  handler.init();

  // Create overlay
  if (settings?.showOverlay !== false) {
    console.log('Prompt Sanitizer: Creating overlay...');
    createOverlay(handler);
  }

  // Watch for textarea changes for auto-sanitize
  observeTextarea(handler);

  // Set up auto-sanitize on submit if enabled
  if (settings?.autoSanitize) {
    setupAutoSanitizeOnSubmit(handler);
  }
}

/**
 * Create the floating overlay button
 */
function createOverlay(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;

  // Remove existing overlay if present
  if (overlayRoot) {
    overlayRoot.remove();
    overlayRoot = null;
    shadowRoot = null;
  }

  // Create container with Shadow DOM for style isolation
  overlayRoot = document.createElement('div');
  overlayRoot.id = `${CSS_PREFIX}-overlay-root`;
  shadowRoot = overlayRoot.attachShadow({ mode: 'closed' });

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = getOverlayStyles();
  shadowRoot.appendChild(styles);

  // Create button container
  const container = document.createElement('div');
  container.className = `${CSS_PREFIX}-container`;
  shadowRoot.appendChild(container);

  // Create the sanitize button
  const button = document.createElement('button');
  button.className = `${CSS_PREFIX}-button`;
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span class="${CSS_PREFIX}-text">Sanitize</span>
  `;
  button.title = 'Click to sanitize your prompt';
  container.appendChild(button);

  // Badge for match count
  const badge = document.createElement('span');
  badge.className = `${CSS_PREFIX}-badge`;
  badge.style.display = 'none';
  container.appendChild(badge);

  // Click handler
  button.addEventListener('click', () => {
    handleSanitizeClick(handler);
  });

  // Add to page
  document.body.appendChild(overlayRoot);

  console.log('Prompt Sanitizer: Overlay added to DOM');

  // Position near the textarea
  positionOverlay(handler);

  // Watch for textarea to appear if not found
  const observer = new MutationObserver(() => {
    const anchor = handler!.getOverlayAnchor();
    if (anchor) {
      positionOverlay(handler!);
      // Stop observing once we found it
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Re-position on scroll/resize
  window.addEventListener('scroll', () => positionOverlay(handler), { passive: true });
  window.addEventListener('resize', () => positionOverlay(handler), { passive: true });
}

/**
 * Position the overlay near the textarea
 */
function positionOverlay(handler: ReturnType<typeof getSiteHandler>) {
  if (!overlayRoot || !shadowRoot || !handler) {
    console.log('Prompt Sanitizer: Cannot position - missing elements');
    return;
  }

  const anchor = handler.getOverlayAnchor();
  if (!anchor) {
    console.log('Prompt Sanitizer: Anchor element not found, retrying...');
    // Set a default visible position so it's not invisible
    const container = shadowRoot.querySelector<HTMLElement>(`.${CSS_PREFIX}-container`);
    if (container) {
      container.style.position = 'fixed';
      container.style.top = '100px';
      container.style.right = '16px';
      container.style.zIndex = String(OVERLAY_Z_INDEX);
    }
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const container = shadowRoot.querySelector<HTMLElement>(`.${CSS_PREFIX}-container`);
  if (!container) return;

  console.log('Prompt Sanitizer: Positioning overlay at', { top: rect.top, right: rect.right });

  // Position at top-right of the input area
  container.style.position = 'fixed';
  container.style.top = `${rect.top + 8}px`;
  container.style.right = `${Math.max(window.innerWidth - rect.right + 8, 16)}px`;
  container.style.zIndex = String(OVERLAY_Z_INDEX);
}

/**
 * Handle sanitize button click
 */
async function handleSanitizeClick(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;

  const text = handler.getInputText();
  if (!text.trim()) {
    showToast('No text to sanitize');
    return;
  }

  const result = sanitize(text, rules);
  
  if (!result.hasChanges) {
    showToast('No matches found');
    return;
  }

  // Show preview and confirm
  const confirmed = await showPreview(text, result.sanitizedText, result.appliedRules);
  
  if (confirmed) {
    handler.setInputText(result.sanitizedText);
    showToast(`Sanitized! ${result.appliedRules.length} rule(s) applied`);
  }
}

/**
 * Show sanitization preview modal
 */
function showPreview(
  original: string,
  sanitized: string,
  appliedRules: { rule: SanitizationRule; matchCount: number }[]
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!shadowRoot) {
      resolve(false);
      return;
    }

    const modal = document.createElement('div');
    modal.className = `${CSS_PREFIX}-modal`;
    modal.innerHTML = `
      <div class="${CSS_PREFIX}-modal-backdrop"></div>
      <div class="${CSS_PREFIX}-modal-content">
        <h3>Sanitization Preview</h3>
        <div class="${CSS_PREFIX}-modal-body">
          <div class="${CSS_PREFIX}-diff">
            <div class="${CSS_PREFIX}-diff-panel">
              <h4>Original</h4>
              <pre>${escapeHtml(original)}</pre>
            </div>
            <div class="${CSS_PREFIX}-diff-panel ${CSS_PREFIX}-diff-sanitized">
              <h4>Sanitized</h4>
              <pre>${escapeHtml(sanitized)}</pre>
            </div>
          </div>
          <div class="${CSS_PREFIX}-rules-applied">
            <h4>Rules Applied:</h4>
            <ul>
              ${appliedRules.map(({ rule, matchCount }) => 
                `<li>${escapeHtml(rule.name)} (${matchCount} match${matchCount > 1 ? 'es' : ''})</li>`
              ).join('')}
            </ul>
          </div>
        </div>
        <div class="${CSS_PREFIX}-modal-actions">
          <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-secondary" data-action="cancel">Cancel</button>
          <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-primary" data-action="apply">Apply Changes</button>
        </div>
      </div>
    `;

    shadowRoot.appendChild(modal);

    // Handle button clicks
    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      
      if (action === 'apply') {
        modal.remove();
        resolve(true);
      } else if (action === 'cancel' || target.classList.contains(`${CSS_PREFIX}-modal-backdrop`)) {
        modal.remove();
        resolve(false);
      }
    });
  });
}

/**
 * Show a toast notification
 */
function showToast(message: string) {
  if (!shadowRoot) return;

  const toast = document.createElement('div');
  toast.className = `${CSS_PREFIX}-toast`;
  toast.textContent = message;
  shadowRoot.appendChild(toast);

  setTimeout(() => {
    toast.classList.add(`${CSS_PREFIX}-toast-fade`);
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Update the badge count based on potential matches
 */
function updateBadge() {
  if (!shadowRoot) return;

  const handler = getSiteHandler();
  if (!handler) return;

  const text = handler.getInputText();
  if (!text.trim()) {
    hideBadge();
    return;
  }

  const result = sanitize(text, rules);
  const badge = shadowRoot.querySelector<HTMLElement>(`.${CSS_PREFIX}-badge`);
  
  if (badge) {
    if (result.appliedRules.length > 0) {
      const totalMatches = result.appliedRules.reduce((sum, r) => sum + r.matchCount, 0);
      badge.textContent = String(totalMatches);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function hideBadge() {
  if (!shadowRoot) return;
  const badge = shadowRoot.querySelector<HTMLElement>(`.${CSS_PREFIX}-badge`);
  if (badge) {
    badge.style.display = 'none';
  }
}

/**
 * Set up auto-sanitize on submit
 */
function setupAutoSanitizeOnSubmit(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;

  // Use MutationObserver to watch for submit button
  const observer = new MutationObserver(() => {
    const submitButton = handler!.getSubmitButton();
    if (submitButton && !submitButton.hasAttribute('data-sanitizer-listener')) {
      setupSubmitButtonListener(submitButton, handler!);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also check immediately
  const submitButton = handler.getSubmitButton();
  if (submitButton) {
    setupSubmitButtonListener(submitButton, handler);
  }

  // Set up keyboard shortcut listener on textarea
  setupKeyboardShortcutListener(handler);
}

/**
 * Attach listener to submit button
 */
function setupSubmitButtonListener(
  button: HTMLElement,
  handler: NonNullable<ReturnType<typeof getSiteHandler>>
) {
  if (button.hasAttribute('data-sanitizer-listener')) {
    return;
  }

  button.setAttribute('data-sanitizer-listener', 'true');

  button.addEventListener('click', async (e) => {
    if (isAutoSanitizing) {
      isAutoSanitizing = false;
      return;
    }

    if (!settings?.autoSanitize) return;

    e.preventDefault();
    e.stopPropagation();

    const text = handler.getInputText();
    if (!text.trim()) {
      showToast('No text to sanitize');
      isAutoSanitizing = false;
      return;
    }

    const result = sanitize(text, rules);

    if (!result.hasChanges) {
      showToast('No PII found, submitting...');
      isAutoSanitizing = false;
      button.click();
      return;
    }

    // Show preview and confirm
    const confirmed = await showPreview(text, result.sanitizedText, result.appliedRules);

    if (confirmed) {
      handler.setInputText(result.sanitizedText);
      showToast(`Auto-sanitized! ${result.appliedRules.length} rule(s) applied`);

      // Re-trigger the click after a short delay to allow state to update
      setTimeout(() => {
        isAutoSanitizing = true;
        button.click();
      }, 100);
    } else {
      showToast('Submission cancelled');
    }
  });
}

/**
 * Set up keyboard shortcut listener (Cmd/Ctrl+Enter)
 */
function setupKeyboardShortcutListener(handler: NonNullable<ReturnType<typeof getSiteHandler>>) {
  const textarea = handler.getTextarea();
  if (!textarea) return;

  textarea.addEventListener('keydown', async (e) => {
    if (isAutoSanitizing) {
      isAutoSanitizing = false;
      return;
    }

    // Check for Cmd+Enter or Ctrl+Enter
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    if (isCmdOrCtrl && e.key === 'Enter') {
      if (!settings?.autoSanitize) return;

      e.preventDefault();

      const text = handler.getInputText();
      if (!text.trim()) {
        showToast('No text to sanitize');
        return;
      }

      const result = sanitize(text, rules);

      if (!result.hasChanges) {
        showToast('No PII found, submitting...');
        return;
      }

      // Show preview and confirm
      const confirmed = await showPreview(text, result.sanitizedText, result.appliedRules);

      if (confirmed) {
        handler.setInputText(result.sanitizedText);
        showToast(`Auto-sanitized! ${result.appliedRules.length} rule(s) applied`);

        // Trigger submit button click after delay
        setTimeout(() => {
          const submitButton = handler.getSubmitButton();
          if (submitButton) {
            isAutoSanitizing = true;
            submitButton.click();
          }
        }, 100);
      } else {
        showToast('Submission cancelled');
      }
    }
  });
}

/**
 * Observe textarea for input changes
 */
function observeTextarea(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;

  // Debounced update
  let timeout: ReturnType<typeof setTimeout>;
  const debouncedUpdate = () => {
    clearTimeout(timeout);
    timeout = setTimeout(updateBadge, 300);
  };

  // Use MutationObserver to detect when textarea appears
  const observer = new MutationObserver(() => {
    const textarea = handler.getTextarea();
    if (textarea) {
      textarea.addEventListener('input', debouncedUpdate);
      textarea.addEventListener('keyup', debouncedUpdate);
      updateBadge();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also check immediately
  const textarea = handler.getTextarea();
  if (textarea) {
    textarea.addEventListener('input', debouncedUpdate);
    textarea.addEventListener('keyup', debouncedUpdate);
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get overlay styles
 */
function getOverlayStyles(): string {
  return `
    .${CSS_PREFIX}-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
    }

    .${CSS_PREFIX}-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
    }

    .${CSS_PREFIX}-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .${CSS_PREFIX}-button:active {
      transform: translateY(0);
    }

    .${CSS_PREFIX}-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      background: #ef4444;
      color: white;
      border-radius: 9px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    .${CSS_PREFIX}-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: ${OVERLAY_Z_INDEX};
      animation: slideUp 0.3s ease;
    }

    .${CSS_PREFIX}-toast-fade {
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .${CSS_PREFIX}-modal {
      position: fixed;
      inset: 0;
      z-index: ${OVERLAY_Z_INDEX};
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .${CSS_PREFIX}-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }

    .${CSS_PREFIX}-modal-content {
      position: relative;
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .${CSS_PREFIX}-modal-content h3 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .${CSS_PREFIX}-modal-content h4 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .${CSS_PREFIX}-diff {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .${CSS_PREFIX}-diff-panel {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
    }

    .${CSS_PREFIX}-diff-panel pre {
      margin: 0;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow: auto;
    }

    .${CSS_PREFIX}-diff-sanitized {
      background: #ecfdf5;
    }

    .${CSS_PREFIX}-rules-applied ul {
      margin: 0;
      padding-left: 20px;
    }

    .${CSS_PREFIX}-rules-applied li {
      margin: 4px 0;
      color: #374151;
    }

    .${CSS_PREFIX}-modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    .${CSS_PREFIX}-btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .${CSS_PREFIX}-btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
    }

    .${CSS_PREFIX}-btn-primary:hover {
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .${CSS_PREFIX}-btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .${CSS_PREFIX}-btn-secondary:hover {
      background: #f9fafb;
    }

    @media (prefers-color-scheme: dark) {
      .${CSS_PREFIX}-modal-content {
        background: #1f2937;
        color: #f9fafb;
      }

      .${CSS_PREFIX}-modal-content h3 {
        color: #f9fafb;
      }

      .${CSS_PREFIX}-diff-panel {
        background: #374151;
      }

      .${CSS_PREFIX}-diff-sanitized {
        background: #065f46;
      }

      .${CSS_PREFIX}-rules-applied li {
        color: #d1d5db;
      }

      .${CSS_PREFIX}-modal-actions {
        border-color: #374151;
      }

      .${CSS_PREFIX}-btn-secondary {
        background: #374151;
        color: #f9fafb;
        border-color: #4b5563;
      }
    }
  `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
