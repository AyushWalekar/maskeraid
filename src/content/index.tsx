import { getSiteHandler } from "./sites";
import { storage } from "../shared/storage";
import { sanitize, testPattern } from "../shared/sanitizer";
import { diffWordsWithSpace } from "diff";
import type {
  SanitizationRule,
  ExtensionSettings,
  ReplacementSession,
} from "../shared/types";
import { CSS_PREFIX, OVERLAY_Z_INDEX } from "../shared/constants";

// State
let rules: SanitizationRule[] = [];
let settings: ExtensionSettings | null = null;
let overlayRoot: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let isAutoSanitizing = false;
let replacementSession: ReplacementSession | null = null;
let overlayCollapsed = false;
let overlayHiddenByUser = false;
const currentHost = window.location.hostname;

/**
 * Initialize the content script
 */
async function init() {
  const handler = getSiteHandler();
  if (!handler) {
    console.log("Prompt Sanitizer: No handler for this site");
    return;
  }

  console.log(`Prompt Sanitizer: Initialized for ${handler.displayName}`);

  // Load rules and settings
  [rules, settings] = await Promise.all([
    storage.getRules(),
    storage.getSettings(),
  ]);

  console.log("Prompt Sanitizer: Settings loaded", settings);

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
      console.log("Prompt Sanitizer: Settings updated", changes.settings);
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
          overlayHiddenByUser = false; // Reset hidden state when re-enabling
          createOverlay(handler);
        } else {
          if (overlayRoot) {
            overlayRoot.remove();
            overlayRoot = null;
            shadowRoot = null;
          }
        }
      }
      // Recompute visibility if overlay mode changed
      if (changes.settings.overlayMode !== undefined) {
        updateBadge();
      }
    }
    if (changes.overlayPositions) {
      console.log(
        "Prompt Sanitizer: Overlay positions updated",
        changes.overlayPositions
      );
      // Reposition overlay if the current host's position changed
      if (!changes.overlayPositions || !changes.overlayPositions[currentHost]) {
        positionOverlay(handler);
      }
    }
  });

  // Initialize handler
  handler.init();

  // Create overlay
  if (settings?.showOverlay !== false) {
    console.log("Prompt Sanitizer: Creating overlay...");
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

  overlayCollapsed = false;
  overlayHiddenByUser = false;

  // Create container with Shadow DOM for style isolation
  overlayRoot = document.createElement("div");
  overlayRoot.id = `${CSS_PREFIX}-overlay-root`;
  shadowRoot = overlayRoot.attachShadow({ mode: "closed" });

  // Inject styles
  const styles = document.createElement("style");
  styles.textContent = getOverlayStyles();
  shadowRoot.appendChild(styles);

  // Create button container
  const container = document.createElement("div");
  container.className = `${CSS_PREFIX}-container`;
  shadowRoot.appendChild(container);

  // Create the sanitize button
  const button = document.createElement("button");
  button.className = `${CSS_PREFIX}-button`;
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span class="${CSS_PREFIX}-text">Sanitize</span>
    <span class="${CSS_PREFIX}-revert-indicator"></span>
  `;
  button.title = "Click to sanitize your prompt";
  container.appendChild(button);

  // Close/collapse button
  const closeButton = document.createElement("button");
  closeButton.className = `${CSS_PREFIX}-close`;
  closeButton.type = "button";
  closeButton.title = "Hide overlay";
  closeButton.setAttribute("aria-label", "Hide overlay");
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6 6 18" />
      <path d="M6 6 18 18" />
    </svg>
  `;
  container.appendChild(closeButton);

  // Mini collapsed button (shown when collapsed)
  const miniButton = document.createElement("button");
  miniButton.className = `${CSS_PREFIX}-mini`;
  miniButton.type = "button";
  miniButton.title = "Show sanitize button";
  miniButton.setAttribute("aria-label", "Show sanitize button");
  miniButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  `;
  container.appendChild(miniButton);

  // Match count + quick-apply (accept) control
  const badgeWrap = document.createElement("div");
  badgeWrap.className = `${CSS_PREFIX}-badge-wrap`;
  badgeWrap.style.display = "none";

  const badgeCount = document.createElement("span");
  badgeCount.className = `${CSS_PREFIX}-badge-count`;
  badgeCount.style.display = "none";
  badgeWrap.appendChild(badgeCount);

  const acceptButton = document.createElement("button");
  acceptButton.className = `${CSS_PREFIX}-quick ${CSS_PREFIX}-accept`;
  acceptButton.type = "button";
  acceptButton.setAttribute("aria-label", "Apply changes without preview");
  acceptButton.dataset.tooltip = "Apply changes without preview";
  acceptButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  `;
  badgeWrap.appendChild(acceptButton);

  const revertButton = document.createElement("button");
  revertButton.className = `${CSS_PREFIX}-quick ${CSS_PREFIX}-revert`;
  revertButton.type = "button";
  revertButton.setAttribute("aria-label", "Revert to original text");
  revertButton.dataset.tooltip = "Revert to original text";
  revertButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12l6-6v4h7a5 5 0 1 1 0 10h-2" />
    </svg>
  `;
  badgeWrap.appendChild(revertButton);

  container.appendChild(badgeWrap);

  // Click handler for sanitize button
  button.addEventListener("click", () => {
    handleSanitizeClick(handler);
  });

  acceptButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleQuickApplyClick(handler);
  });

  revertButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleQuickRevertClick(handler);
  });

  closeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlayHiddenByUser = true;
    if (overlayRoot) {
      overlayRoot.style.display = "none";
    }
    showToast("Overlay hidden");
  });

  miniButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlayCollapsed = false;
    updateOverlayPresentation();
  });

  // Make container draggable
  setupDragAndDrop(container, button);

  // Add to page
  document.body.appendChild(overlayRoot);

  console.log("Prompt Sanitizer: Overlay added to DOM");

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
  window.addEventListener("scroll", () => positionOverlay(handler), {
    passive: true,
  });
  window.addEventListener("resize", () => positionOverlay(handler), {
    passive: true,
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanup);

  // Ensure correct initial visibility/presentation
  updateBadge();
}

/**
 * Position the overlay near the textarea
 */
async function positionOverlay(handler: ReturnType<typeof getSiteHandler>) {
  if (!overlayRoot || !shadowRoot || !handler) {
    console.log("Prompt Sanitizer: Cannot position - missing elements");
    return;
  }

  const container = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-container`
  );
  if (!container) return;

  // Check if we have a saved position for this host
  const savedPosition = await storage.getOverlayPosition(currentHost);
  if (savedPosition) {
    console.log("Prompt Sanitizer: Using saved position", savedPosition);
    container.style.position = "fixed";
    container.style.top = `${savedPosition.top}px`;
    container.style.right = `${savedPosition.right}px`;
    container.style.zIndex = String(OVERLAY_Z_INDEX);
    container.classList.add(`${CSS_PREFIX}-draggable`);
    return;
  }

  const anchor = handler.getOverlayAnchor();
  if (!anchor) {
    console.log("Prompt Sanitizer: Anchor element not found, retrying...");
    // Set a default visible position so it's not invisible
    container.style.position = "fixed";
    container.style.top = "100px";
    container.style.right = "16px";
    container.style.zIndex = String(OVERLAY_Z_INDEX);
    return;
  }

  const rect = anchor.getBoundingClientRect();

  console.log("Prompt Sanitizer: Positioning overlay at", {
    top: rect.top,
    right: rect.right,
  });

  // Position at top-right of the input area
  container.style.position = "fixed";
  container.style.top = `${rect.top + 8}px`;
  container.style.right = `${Math.max(
    window.innerWidth - rect.right + 8,
    16
  )}px`;
  container.style.zIndex = String(OVERLAY_Z_INDEX);
  container.classList.add(`${CSS_PREFIX}-draggable`);
}

/**
 * Handle sanitize button click
 */
async function handleSanitizeClick(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;

  const text = handler.getInputText();
  if (!text.trim()) {
    showToast("No text to sanitize");
    return;
  }

  // If there's an active replacement session and current text matches sanitized text,
  // show the review/revert modal
  if (replacementSession && text === replacementSession.sanitizedText) {
    const previewResult = await showPreview(
      replacementSession.originalText,
      replacementSession.sanitizedText,
      [],
      true
    );

    if (previewResult.action === "revert") {
      revertSanitization(handler);
    }
    return;
  }

  const result = sanitize(text, rules);

  // if (!result.hasChanges) {
  //   showToast('No matches found');
  //   return;
  // }

  // Show preview and confirm
  const previewResult = await showPreview(
    text,
    result.sanitizedText,
    result.appliedRules
  );

  if (
    previewResult.action === "apply" &&
    previewResult.sanitizedText &&
    previewResult.appliedRules
  ) {
    applySanitization(
      handler,
      text,
      previewResult.sanitizedText,
      previewResult.appliedRules
    );
  }
}

async function handleQuickApplyClick(
  handler: ReturnType<typeof getSiteHandler>
) {
  if (!handler) return;

  const text = handler.getInputText();
  if (!text.trim()) {
    showToast("No text to sanitize");
    return;
  }

  // If already sanitized, preserve the review/revert flow instead of re-applying.
  if (replacementSession && text === replacementSession.sanitizedText) {
    const previewResult = await showPreview(
      replacementSession.originalText,
      replacementSession.sanitizedText,
      [],
      true
    );
    if (previewResult.action === "revert") {
      revertSanitization(handler);
    }
    return;
  }

  const result = sanitize(text, rules);
  if (!result.hasChanges) {
    showToast("No matches found");
    return;
  }

  applySanitization(handler, text, result.sanitizedText, result.appliedRules);
}

function handleQuickRevertClick(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler) return;
  revertSanitization(handler);
}

function applySanitization(
  handler: ReturnType<typeof getSiteHandler>,
  originalText: string,
  sanitizedText: string,
  appliedRules: {
    rule: SanitizationRule;
    matchCount: number;
    replacementMap: Record<string, string>;
  }[]
): void {
  if (!handler) return;

  replacementSession = {
    originalText,
    sanitizedText,
    replacementMaps: appliedRules.map((r) => r.replacementMap),
    timestamp: Date.now(),
  };

  handler.setInputText(sanitizedText);
  showToast(`Sanitized! ${appliedRules.length} rule(s) applied`);

  const revertIndicator = shadowRoot?.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-revert-indicator`
  );
  if (revertIndicator) {
    revertIndicator.style.display = "block";
  }

  updateQuickActions(0);
  updateOverlayVisibility(0, true);
}

/**
 * Sanitize text with specific rules
 */
function sanitizeWithRules(
  text: string,
  selectedRules: SanitizationRule[]
): ReturnType<typeof sanitize> {
  // Temporarily enable selected rules and disable others
  const originalEnabledStates = rules.map((r) => r.enabled);
  rules.forEach((r) => {
    r.enabled = selectedRules.some((sr) => sr.id === r.id);
  });
  const result = sanitize(text, rules);
  // Restore original enabled states
  rules.forEach((r, i) => {
    r.enabled = originalEnabledStates[i];
  });
  return result;
}

/**
 * Find all rules that match the text
 */
function findMatchingRules(text: string): Array<{
  rule: SanitizationRule;
  matchCount: number;
}> {
  const matchingRules: Array<{ rule: SanitizationRule; matchCount: number }> =
    [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const { count } = testPattern(text, rule.pattern, rule.isRegex, rule.flags);

    if (count > 0) {
      matchingRules.push({ rule, matchCount: count });
    }
  }

  return matchingRules;
}

/**
 * Show sanitization preview modal
 */
function showPreview(
  original: string,
  sanitized: string,
  _appliedRules: { rule: SanitizationRule; matchCount: number }[],
  showRevertOption = false
): Promise<{
  action: "apply" | "cancel" | "revert";
  sanitizedText?: string;
  appliedRules?: Array<{
    rule: SanitizationRule;
    matchCount: number;
    replacementMap: Record<string, string>;
  }>;
}> {
  return new Promise((resolve) => {
    if (!shadowRoot) {
      resolve({ action: "cancel" });
      return;
    }

    // Find all matching rules (only show rules that match)
    const allMatchingRules = findMatchingRules(original);

    // If no matching rules, fall back to original behavior
    if (allMatchingRules.length === 0 && !showRevertOption) {
      const diffColumns = renderDiffColumns(original, sanitized);
      const modal = document.createElement("div");
      modal.className = `${CSS_PREFIX}-modal`;
      modal.innerHTML = `
        <div class="${CSS_PREFIX}-modal-backdrop"></div>
        <div class="${CSS_PREFIX}-modal-content">
          <h3>Sanitization Preview</h3>
          <div class="${CSS_PREFIX}-modal-body">
            <div class="${CSS_PREFIX}-diff">
              <div class="${CSS_PREFIX}-diff-panel">
                <h4>Original</h4>
                <pre class="${CSS_PREFIX}-diff-text">${diffColumns.originalHtml}</pre>
              </div>
              <div class="${CSS_PREFIX}-diff-panel ${CSS_PREFIX}-diff-sanitized">
                <h4>Sanitized</h4>
                <pre class="${CSS_PREFIX}-diff-text">${diffColumns.sanitizedHtml}</pre>
              </div>
            </div>
          </div>
          <div class="${CSS_PREFIX}-modal-actions">
            <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-secondary" data-action="cancel">Cancel</button>
            <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-primary" data-action="apply">Apply Changes</button>
          </div>
        </div>
      `;
      shadowRoot.appendChild(modal);
      modal.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        if (action === "apply") {
          modal.remove();
          resolve({
            action: "apply",
            sanitizedText: sanitized,
            appliedRules: [],
          });
        } else if (
          action === "cancel" ||
          target.classList.contains(`${CSS_PREFIX}-modal-backdrop`)
        ) {
          modal.remove();
          resolve({ action: "cancel" });
        }
      });
      return;
    }

    // Track selected rules (all selected by default)
    const selectedRuleIds = new Set(allMatchingRules.map((r) => r.rule.id));

    // Initial sanitization with all rules selected
    let currentResult = sanitizeWithRules(
      original,
      allMatchingRules.map((r) => r.rule)
    );
    let currentSanitized = currentResult.sanitizedText;

    const updatePreview = () => {
      const rulesToApply = allMatchingRules
        .filter((r) => selectedRuleIds.has(r.rule.id))
        .map((r) => r.rule);

      currentResult = sanitizeWithRules(original, rulesToApply);
      currentSanitized = currentResult.sanitizedText;

      const diffColumns = renderDiffColumns(original, currentSanitized);

      const originalPanel = modal.querySelector<HTMLElement>(
        `.${CSS_PREFIX}-diff-panel:first-child pre`
      );
      const sanitizedPanel = modal.querySelector<HTMLElement>(
        `.${CSS_PREFIX}-diff-panel:last-child pre`
      );

      if (originalPanel) {
        originalPanel.innerHTML = diffColumns.originalHtml;
      }
      if (sanitizedPanel) {
        sanitizedPanel.innerHTML = diffColumns.sanitizedHtml;
      }

      // Update rule checkboxes
      allMatchingRules.forEach(({ rule }) => {
        const checkbox = modal.querySelector<HTMLInputElement>(
          `input[data-rule-id="${rule.id}"]`
        );
        if (checkbox) {
          checkbox.checked = selectedRuleIds.has(rule.id);
        }
      });
    };

    const diffColumns = renderDiffColumns(original, currentSanitized);

    const modal = document.createElement("div");
    modal.className = `${CSS_PREFIX}-modal`;
    modal.innerHTML = `
      <div class="${CSS_PREFIX}-modal-backdrop"></div>
      <div class="${CSS_PREFIX}-modal-content">
        <h3>${
          showRevertOption ? "Review Sanitization" : "Sanitization Preview"
        }</h3>
        <div class="${CSS_PREFIX}-modal-body">
          <div class="${CSS_PREFIX}-diff">
            <div class="${CSS_PREFIX}-diff-panel">
              <h4>Original</h4>
              <pre class="${CSS_PREFIX}-diff-text">${
      diffColumns.originalHtml
    }</pre>
            </div>
            <div class="${CSS_PREFIX}-diff-panel ${CSS_PREFIX}-diff-sanitized">
              <h4>Sanitized</h4>
              <pre class="${CSS_PREFIX}-diff-text">${
      diffColumns.sanitizedHtml
    }</pre>
            </div>
          </div>
          ${
            allMatchingRules.length > 0
              ? `
            <div class="${CSS_PREFIX}-rules-accordion">
              <button class="${CSS_PREFIX}-rules-accordion-header" type="button" aria-expanded="false">
                <span>Rules Applied (${allMatchingRules.length})</span>
                <svg class="${CSS_PREFIX}-accordion-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              <div class="${CSS_PREFIX}-rules-accordion-content" style="display: none;">
                <div class="${CSS_PREFIX}-rules-list">
                  ${allMatchingRules
                    .map(
                      ({ rule, matchCount }) => `
                    <label class="${CSS_PREFIX}-rule-item">
                      <input type="checkbox" data-rule-id="${
                        rule.id
                      }" checked />
                      <span class="${CSS_PREFIX}-rule-name">${escapeHtml(
                        rule.name
                      )}</span>
                      <span class="${CSS_PREFIX}-rule-count">${matchCount} match${
                        matchCount > 1 ? "es" : ""
                      }</span>
                    </label>
                  `
                    )
                    .join("")}
                </div>
              </div>
            </div>
          `
              : ""
          }
        </div>
        <div class="${CSS_PREFIX}-modal-actions">
          ${
            showRevertOption
              ? `
              <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-danger" data-action="revert">Revert Changes</button>
              <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-primary" data-action="keep">Keep Changes</button>
            `
              : `
              <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-secondary" data-action="cancel">Cancel</button>
              <button class="${CSS_PREFIX}-btn ${CSS_PREFIX}-btn-primary" data-action="apply">Apply Changes</button>
            `
          }
        </div>
      </div>
    `;

    shadowRoot.appendChild(modal);

    // Setup accordion toggle
    if (allMatchingRules.length > 0) {
      const accordionHeader = modal.querySelector<HTMLElement>(
        `.${CSS_PREFIX}-rules-accordion-header`
      );
      const accordionContent = modal.querySelector<HTMLElement>(
        `.${CSS_PREFIX}-rules-accordion-content`
      );
      const accordionIcon = modal.querySelector<HTMLElement>(
        `.${CSS_PREFIX}-accordion-icon`
      );

      if (accordionHeader && accordionContent && accordionIcon) {
        accordionHeader.addEventListener("click", () => {
          const isExpanded =
            accordionHeader.getAttribute("aria-expanded") === "true";
          accordionHeader.setAttribute("aria-expanded", String(!isExpanded));
          accordionContent.style.display = isExpanded ? "none" : "block";
          accordionIcon.style.transform = isExpanded
            ? "rotate(0deg)"
            : "rotate(180deg)";
        });
      }

      // Setup checkbox handlers
      const checkboxes =
        modal.querySelectorAll<HTMLInputElement>(`input[data-rule-id]`);
      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const ruleId = checkbox.dataset.ruleId;
          if (!ruleId) return;

          if (checkbox.checked) {
            selectedRuleIds.add(ruleId);
          } else {
            selectedRuleIds.delete(ruleId);
          }

          updatePreview();
        });
      });
    }

    // Initial update to ensure checkboxes are synced
    if (allMatchingRules.length > 0) {
      updatePreview();
    }

    // Handle button clicks
    modal.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action === "apply" || action === "keep") {
        // Get selected rules for result with replacementMap from current result
        const selectedAppliedRules = currentResult.appliedRules.filter((ar) =>
          selectedRuleIds.has(ar.rule.id)
        );

        modal.remove();
        resolve({
          action: "apply",
          sanitizedText: currentSanitized,
          appliedRules: selectedAppliedRules,
        });
      } else if (action === "revert") {
        modal.remove();
        resolve({ action: "revert" });
      } else if (
        action === "cancel" ||
        target.classList.contains(`${CSS_PREFIX}-modal-backdrop`)
      ) {
        modal.remove();
        resolve({ action: "cancel" });
      }
    });
  });
}

function renderDiffColumns(
  original: string,
  sanitized: string
): { originalHtml: string; sanitizedHtml: string } {
  const parts = diffWordsWithSpace(original, sanitized);

  let originalHtml = "";
  let sanitizedHtml = "";

  for (const part of parts) {
    const safe = escapeHtml(part.value);

    // Original column: include removals + unchanged, skip additions
    if (!part.added) {
      if (part.removed) {
        originalHtml += `<span class="${CSS_PREFIX}-diff-removed">${safe}</span>`;
      } else {
        originalHtml += safe;
      }
    }

    // Sanitized column: include additions + unchanged, skip removals
    if (!part.removed) {
      if (part.added) {
        sanitizedHtml += `<span class="${CSS_PREFIX}-diff-added">${safe}</span>`;
      } else {
        sanitizedHtml += safe;
      }
    }
  }

  return { originalHtml, sanitizedHtml };
}

/**
 * Revert the last sanitization
 */
function revertSanitization(handler: ReturnType<typeof getSiteHandler>) {
  if (!handler || !replacementSession) {
    showToast("No sanitization to revert");
    return;
  }

  handler.setInputText(replacementSession.originalText);
  replacementSession = null;

  // Hide revert indicator
  const revertIndicator = shadowRoot?.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-revert-indicator`
  );
  if (revertIndicator) {
    revertIndicator.style.display = "none";
  }

  showToast("Reverted to original text");
  updateQuickActions(0);
  updateBadge();
}

/**
 * Setup drag and drop for the overlay container
 */
function setupDragAndDrop(container: HTMLElement, button: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialRight = 0;
  let initialTop = 0;

  // Use the button as the drag handle
  button.style.cursor = "grab";

  button.addEventListener("mousedown", (e) => {
    // Only left click
    if (e.button !== 0) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialRight = parseInt(container.style.right) || 0;
    initialTop = parseInt(container.style.top) || 0;

    button.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = startX - e.clientX;
    const deltaY = e.clientY - startY;

    container.style.right = `${Math.max(0, initialRight + deltaX)}px`;
    container.style.top = `${Math.max(0, initialTop + deltaY)}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;

    isDragging = false;
    button.style.cursor = "grab";

    // Save the new position
    const newRight = parseInt(container.style.right) || 0;
    const newTop = parseInt(container.style.top) || 0;

    await storage.setOverlayPosition(currentHost, {
      top: newTop,
      right: newRight,
    });
    console.log("Prompt Sanitizer: Position saved", {
      top: newTop,
      right: newRight,
    });
  });

  // Add context menu for reset option
  container.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset position
    await storage.resetOverlayPosition(currentHost);
    positionOverlay(getSiteHandler());
    showToast("Position reset to default");
  });
}

/**
 * Show a toast notification
 */
function showToast(message: string) {
  if (!shadowRoot) return;

  const toast = document.createElement("div");
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
    updateOverlayVisibility(0, false);
    return;
  }

  const result = sanitize(text, rules);
  let totalMatches = 0;

  if (result.appliedRules.length > 0) {
    totalMatches = result.appliedRules.reduce(
      (sum, r) => sum + r.matchCount,
      0
    );
    updateOverlayVisibility(totalMatches, true);
  } else {
    updateOverlayVisibility(0, true);
  }

  updateQuickActions(totalMatches);
}

function hideBadge() {
  if (!shadowRoot) return;
  updateQuickActions(0);
}

function updateQuickActions(totalMatches: number): void {
  if (!shadowRoot) return;

  const badgeWrap = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-badge-wrap`
  );
  const badgeCount = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-badge-count`
  );
  const acceptButton = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-accept`
  );
  const revertButton = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-revert`
  );

  if (!badgeWrap || !badgeCount || !acceptButton || !revertButton) {
    return;
  }

  const hasMatches = totalMatches > 0;
  const hasSession = Boolean(replacementSession);

  if (hasMatches) {
    badgeCount.style.display = "inline";
    badgeCount.textContent = String(totalMatches);
  } else {
    badgeCount.style.display = "none";
    badgeCount.textContent = "";
  }

  acceptButton.style.display = hasMatches && totalMatches > 1 ? "flex" : "none";
  revertButton.style.display = hasSession ? "flex" : "none";

  badgeWrap.style.display = hasMatches || hasSession ? "flex" : "none";
}

function updateOverlayVisibility(totalMatches: number, hasText: boolean): void {
  if (!shadowRoot || !overlayRoot) return;
  const container = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-container`
  );
  const button = shadowRoot.querySelector<HTMLButtonElement>(
    `.${CSS_PREFIX}-button`
  );
  if (!container || !button) return;

  // If user explicitly hid the overlay, don't show it
  if (overlayHiddenByUser) {
    overlayRoot.style.display = "none";
    return;
  }

  const overlayEnabled = settings?.showOverlay !== false;
  const mode = settings?.overlayMode ?? "smart";
  const shouldShow =
    overlayEnabled &&
    (mode === "always" ||
      (mode === "smart" && (totalMatches > 0 || Boolean(replacementSession))));

  overlayRoot.style.display = shouldShow ? "block" : "none";

  if (!shouldShow) {
    return;
  }

  // Always keep the button clickable so users can re-open the review/revert flow
  // even after sanitization has already been applied.
  button.title = hasText
    ? "Click to sanitize your prompt"
    : "No text to sanitize";

  updateOverlayPresentation();
}

function updateOverlayPresentation(): void {
  if (!shadowRoot) return;
  const button = shadowRoot.querySelector<HTMLElement>(`.${CSS_PREFIX}-button`);
  const closeButton = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-close`
  );
  const miniButton = shadowRoot.querySelector<HTMLElement>(
    `.${CSS_PREFIX}-mini`
  );

  if (!button || !closeButton || !miniButton) return;

  if (overlayCollapsed) {
    button.style.display = "none";
    closeButton.style.display = "none";
    miniButton.style.display = "flex";
  } else {
    button.style.display = "flex";
    closeButton.style.display = "flex";
    miniButton.style.display = "none";
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
    if (submitButton && !submitButton.hasAttribute("data-sanitizer-listener")) {
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
  if (button.hasAttribute("data-sanitizer-listener")) {
    return;
  }

  button.setAttribute("data-sanitizer-listener", "true");

  button.addEventListener("click", async (e) => {
    if (isAutoSanitizing) {
      isAutoSanitizing = false;
      return;
    }

    if (!settings?.autoSanitize) return;

    e.preventDefault();
    e.stopPropagation();

    const text = handler.getInputText();
    if (!text.trim()) {
      showToast("No text to sanitize");
      isAutoSanitizing = false;
      return;
    }

    const result = sanitize(text, rules);

    if (!result.hasChanges) {
      showToast("No PII found, submitting...");
      isAutoSanitizing = false;
      button.click();
      return;
    }

    // Show preview and confirm
    const previewResult = await showPreview(
      text,
      result.sanitizedText,
      result.appliedRules
    );

    if (
      previewResult.action === "apply" &&
      previewResult.sanitizedText &&
      previewResult.appliedRules
    ) {
      handler.setInputText(previewResult.sanitizedText);
      showToast(
        `Auto-sanitized! ${previewResult.appliedRules.length} rule(s) applied`
      );

      // Re-trigger the click after a short delay to allow state to update
      setTimeout(() => {
        isAutoSanitizing = true;
        button.click();
      }, 100);
    } else {
      showToast("Submission cancelled");
    }
  });
}

/**
 * Set up keyboard shortcut listener (Cmd/Ctrl+Enter)
 */
function setupKeyboardShortcutListener(
  handler: NonNullable<ReturnType<typeof getSiteHandler>>
) {
  const textarea = handler.getTextarea();
  if (!textarea) return;

  textarea.addEventListener("keydown", async (e) => {
    if (isAutoSanitizing) {
      isAutoSanitizing = false;
      return;
    }

    // Check for Cmd+Enter or Ctrl+Enter
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    if (isCmdOrCtrl && e.key === "Enter") {
      if (!settings?.autoSanitize) return;

      e.preventDefault();

      const text = handler.getInputText();
      if (!text.trim()) {
        showToast("No text to sanitize");
        return;
      }

      const result = sanitize(text, rules);

      if (!result.hasChanges) {
        showToast("No PII found, submitting...");
        return;
      }

      // Show preview and confirm
      const previewResult = await showPreview(
        text,
        result.sanitizedText,
        result.appliedRules
      );

      if (
        previewResult.action === "apply" &&
        previewResult.sanitizedText &&
        previewResult.appliedRules
      ) {
        handler.setInputText(previewResult.sanitizedText);
        showToast(
          `Auto-sanitized! ${previewResult.appliedRules.length} rule(s) applied`
        );

        // Trigger submit button click after delay
        setTimeout(() => {
          const submitButton = handler.getSubmitButton();
          if (submitButton) {
            isAutoSanitizing = true;
            submitButton.click();
          }
        }, 100);
      } else {
        showToast("Submission cancelled");
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

  // Clear session on input (user made changes)
  const handleInput = () => {
    if (replacementSession) {
      const currentText = handler.getInputText();
      if (currentText !== replacementSession.sanitizedText) {
        replacementSession = null;
        // Hide revert indicator
        const revertIndicator = shadowRoot?.querySelector<HTMLElement>(
          `.${CSS_PREFIX}-revert-indicator`
        );
        if (revertIndicator) {
          revertIndicator.style.display = "none";
        }
      }
    }
    debouncedUpdate();
  };

  // Use MutationObserver to detect when textarea appears
  const observer = new MutationObserver(() => {
    const textarea = handler.getTextarea();
    if (textarea) {
      textarea.addEventListener("input", handleInput);
      textarea.addEventListener("keyup", handleInput);
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
    textarea.addEventListener("input", handleInput);
    textarea.addEventListener("keyup", handleInput);
  }
}

/**
 * Cleanup on page unload
 */
function cleanup() {
  replacementSession = null;
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get overlay styles
 */
function getOverlayStyles(): string {
  return `
    :host {
      /* Theme tokens (mirrors src/index.css) */
      --background: oklch(0.97 0.01 81.76);
      --foreground: oklch(0.3 0.04 29.2);
      --primary: oklch(0.52 0.13 144.33);
      --primary-foreground: oklch(1 0 0);
      --secondary: oklch(0.96 0.02 147.54);
      --secondary-foreground: oklch(0.43 0.12 144.33);
      --chart-2: oklch(0.58 0.14 144.14);
      --accent: oklch(0.9 0.05 146.01);
      --accent-foreground: oklch(0.43 0.12 144.33);
      --muted: oklch(0.94 0.01 72.65);
      --muted-foreground: oklch(0.45 0.05 38.69);
      --border: oklch(0.88 0.02 77.29);
      --ring: oklch(0.52 0.13 144.33);
      --destructive: oklch(0.54 0.19 26.9);
      --destructive-foreground: oklch(1 0 0);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --background: oklch(0.27 0.03 150.18);
        --foreground: oklch(0.94 0.01 72.65);
        --primary: oklch(0.67 0.16 144.06);
        --primary-foreground: oklch(0.22 0.05 145.19);
        --secondary: oklch(0.39 0.03 143.09);
        --secondary-foreground: oklch(0.9 0.02 142.94);
        --chart-2: oklch(0.72 0.14 144.92);
        --accent: oklch(0.58 0.14 144.14);
        --accent-foreground: oklch(0.94 0.01 72.65);
        --muted: oklch(0.33 0.03 146.53);
        --muted-foreground: oklch(0.86 0.02 77.29);
        --border: oklch(0.39 0.03 143.09);
        --ring: oklch(0.67 0.16 144.06);
        --destructive: oklch(0.54 0.19 26.9);
        --destructive-foreground: oklch(1 0 0);
      }
    }

    .${CSS_PREFIX}-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
      position: relative;
      display: block;
    }

    .${CSS_PREFIX}-container.${CSS_PREFIX}-draggable .${CSS_PREFIX}-button {
      cursor: grab;
    }

    .${CSS_PREFIX}-container.${CSS_PREFIX}-draggable .${CSS_PREFIX}-button:active {
      cursor: grabbing;
    }

    .${CSS_PREFIX}-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--chart-2) 100%);
      color: var(--primary-foreground);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 8px 20px oklch(0 0 0 / 0.18);
      transition: all 0.2s ease;
    }

    .${CSS_PREFIX}-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px oklch(0 0 0 / 0.22);
    }

    .${CSS_PREFIX}-button:active {
      transform: translateY(0);
    }

    .${CSS_PREFIX}-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
      box-shadow: 0 6px 16px oklch(0 0 0 / 0.14);
    }

    .${CSS_PREFIX}-close {
      position: absolute;
      top: -8px;
      left: -8px;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--muted-foreground);
      cursor: pointer;
      box-shadow: 0 6px 16px oklch(0 0 0 / 0.14);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .${CSS_PREFIX}-close:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px oklch(0 0 0 / 0.18);
      color: var(--foreground);
    }

    .${CSS_PREFIX}-mini {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--chart-2) 100%);
      color: var(--primary-foreground);
      cursor: pointer;
      box-shadow: 0 8px 20px oklch(0 0 0 / 0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .${CSS_PREFIX}-mini:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px oklch(0 0 0 / 0.22);
    }

    .${CSS_PREFIX}-badge-wrap {
      position: absolute;
      top: -6px;
      right: -6px;
      display: none;
      align-items: center;
      gap: 4px;
      padding: 0 4px;
      height: 22px;
      border-radius: 999px;
      background: color-mix(in oklch, var(--destructive) 88%, black 10%);
      color: var(--destructive-foreground);
      border: 1px solid color-mix(in oklch, var(--destructive) 55%, black 20%);
      box-shadow: 0 6px 16px oklch(0 0 0 / 0.16);
    }

    .${CSS_PREFIX}-badge-count {
      min-width: 14px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      padding: 0 2px;
      user-select: none;
      display: none;
    }

    .${CSS_PREFIX}-quick {
      width: 18px;
      height: 18px;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
      padding: 0;
    }

    .${CSS_PREFIX}-quick::after {
      content: attr(data-tooltip);
      position: absolute;
      top: -32px;
      right: 0;
      transform: translateX(50%);
      background: var(--foreground);
      color: var(--background);
      font-size: 11px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: 999px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease, transform 0.15s ease;
      box-shadow: 0 8px 16px oklch(0 0 0 / 0.18);
    }

    .${CSS_PREFIX}-quick:hover::after {
      opacity: 1;
      transform: translateX(50%) translateY(-2px);
    }

    .${CSS_PREFIX}-accept,
    .${CSS_PREFIX}-revert {
      position: relative;
    }

    .${CSS_PREFIX}-accept {
      background: color-mix(in oklch, var(--background) 25%, transparent);
      color: var(--destructive-foreground);
    }

    .${CSS_PREFIX}-accept:hover {
      transform: translateY(-1px);
      background: color-mix(in oklch, var(--background) 38%, transparent);
    }

    .${CSS_PREFIX}-revert {
      background: color-mix(in oklch, var(--accent) 25%, transparent);
      color: var(--accent-foreground);
    }

    .${CSS_PREFIX}-revert:hover {
      transform: translateY(-1px);
      background: color-mix(in oklch, var(--accent) 40%, transparent);
    }

    .${CSS_PREFIX}-revert-indicator {
      display: none;
      position: absolute;
      top: -2px;
      right: -2px;
      width: 10px;
      height: 10px;
      background: #f59e0b;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.8;
        transform: scale(1.1);
      }
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
      background: var(--background);
      color: var(--foreground);
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
      color: var(--foreground);
    }

    .${CSS_PREFIX}-modal-content h4 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted-foreground);
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
      background: var(--muted);
      border-radius: 8px;
      padding: 12px;
      border: 1px solid var(--border);
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
      background: color-mix(in oklch, var(--accent) 35%, var(--background));
    }

    .${CSS_PREFIX}-diff-text {
      line-height: 1.45;
    }

    .${CSS_PREFIX}-diff-added {
      background: color-mix(in oklch, var(--primary) 22%, transparent);
      border-radius: 3px;
      padding: 0 1px;
    }

    .${CSS_PREFIX}-diff-removed {
      background: color-mix(in oklch, var(--destructive) 18%, transparent);
      border-radius: 3px;
      padding: 0 1px;
      text-decoration: line-through;
    }

    .${CSS_PREFIX}-rules-accordion {
      margin-top: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    .${CSS_PREFIX}-rules-accordion-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--muted);
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: var(--foreground);
      transition: background 0.15s ease;
    }

    .${CSS_PREFIX}-rules-accordion-header:hover {
      background: color-mix(in oklch, var(--muted) 90%, var(--accent));
    }

    .${CSS_PREFIX}-accordion-icon {
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }

    .${CSS_PREFIX}-rules-accordion-content {
      padding: 12px 16px;
      background: var(--background);
      border-top: 1px solid var(--border);
    }

    .${CSS_PREFIX}-rules-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .${CSS_PREFIX}-rule-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .${CSS_PREFIX}-rule-item:hover {
      background: var(--muted);
    }

    .${CSS_PREFIX}-rule-item input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--primary);
      flex-shrink: 0;
    }

    .${CSS_PREFIX}-rule-name {
      flex: 1;
      font-size: 13px;
      color: var(--foreground);
      font-weight: 500;
    }

    .${CSS_PREFIX}-rule-count {
      font-size: 12px;
      color: var(--muted-foreground);
      padding: 2px 8px;
      background: var(--muted);
      border-radius: 12px;
      white-space: nowrap;
    }

    .${CSS_PREFIX}-modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
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
      background: linear-gradient(135deg, var(--primary) 0%, var(--chart-2) 100%);
      color: var(--primary-foreground);
      border: none;
    }

    .${CSS_PREFIX}-btn-primary:hover {
      box-shadow: 0 10px 24px oklch(0 0 0 / 0.22);
    }

    .${CSS_PREFIX}-btn-secondary {
      background: var(--background);
      color: var(--foreground);
      border: 1px solid var(--border);
    }

    .${CSS_PREFIX}-btn-secondary:hover {
      background: color-mix(in oklch, var(--muted) 70%, var(--background));
    }

    .${CSS_PREFIX}-btn-danger {
      background: linear-gradient(135deg, var(--destructive) 0%, color-mix(in oklch, var(--destructive) 78%, black) 100%);
      color: var(--destructive-foreground);
      border: none;
    }

    .${CSS_PREFIX}-btn-danger:hover {
      box-shadow: 0 10px 24px oklch(0 0 0 / 0.22);
    }

    @media (prefers-color-scheme: dark) {
      .${CSS_PREFIX}-modal-content {
        background: var(--background);
        color: var(--foreground);
      }

      .${CSS_PREFIX}-modal-content h3 {
        color: var(--foreground);
      }

      .${CSS_PREFIX}-diff-panel {
        background: var(--muted);
      }

      .${CSS_PREFIX}-diff-sanitized {
        background: color-mix(in oklch, var(--accent) 35%, var(--background));
      }

      .${CSS_PREFIX}-rules-accordion-header {
        background: var(--muted);
        color: var(--foreground);
      }

      .${CSS_PREFIX}-rules-accordion-header:hover {
        background: color-mix(in oklch, var(--muted) 90%, var(--accent));
      }

      .${CSS_PREFIX}-rules-accordion-content {
        background: var(--background);
        border-color: var(--border);
      }

      .${CSS_PREFIX}-rule-item:hover {
        background: var(--muted);
      }

      .${CSS_PREFIX}-rule-name {
        color: var(--foreground);
      }

      .${CSS_PREFIX}-rule-count {
        color: var(--muted-foreground);
        background: var(--muted);
      }

      .${CSS_PREFIX}-modal-actions {
        border-color: var(--border);
      }

      .${CSS_PREFIX}-btn-secondary {
        background: var(--background);
        color: var(--foreground);
        border-color: var(--border);
      }

      .${CSS_PREFIX}-btn-danger {
        background: linear-gradient(135deg, var(--destructive) 0%, color-mix(in oklch, var(--destructive) 72%, black) 100%);
      }
    }
  `;
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
