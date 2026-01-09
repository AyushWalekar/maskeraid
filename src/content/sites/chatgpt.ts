import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for ChatGPT (chat.openai.com and chatgpt.com)
 */
export class ChatGPTHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "chatgpt";
  readonly displayName = "ChatGPT";

  // ChatGPT uses ProseMirror-like contenteditable div
  private readonly selectors = {
    // The main prompt textarea (contenteditable div)
    textarea: '#prompt-textarea, div[contenteditable="true"][data-placeholder]',
    // The send button
    submitButton:
      'button[data-testid="send-button"], button[aria-label="Send prompt"]',
    // Container to anchor overlay
    container: "form, main",
  };

  matches(url: string): boolean {
    return /^https:\/\/(chat\.openai\.com|chatgpt\.com)/.test(url);
  }

  getTextarea(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.selectors.textarea);
  }

  getInputText(): string {
    const textarea = this.getTextarea();
    if (!textarea) return "";

    // ChatGPT uses contenteditable div
    if (textarea.getAttribute("contenteditable") === "true") {
      return textarea.innerText || "";
    }

    // Fallback for actual textarea
    return (textarea as HTMLTextAreaElement).value || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.getAttribute("contenteditable") === "true") {
      // For contenteditable, we need to handle it carefully
      textarea.focus();

      // Clear existing content
      textarea.innerHTML = "";

      // Handle multi-line text by inserting paragraphs (like Claude)
      // Using innerText directly causes extra newlines in ProseMirror editors
      const lines = text.split("\n");
      lines.forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line || "\u200B"; // Zero-width space for empty lines
        textarea.appendChild(p);
      });

      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textarea);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      // Standard textarea
      (textarea as HTMLTextAreaElement).value = text;
    }

    this.triggerInputEvent(textarea);
  }

  getOverlayAnchor(): HTMLElement | null {
    // Position near the textarea container
    const textarea = this.getTextarea();
    if (textarea) {
      return textarea.closest("form") || textarea.parentElement;
    }
    return document.querySelector<HTMLElement>(this.selectors.container);
  }

  getSubmitButton(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.selectors.submitButton);
  }
}
