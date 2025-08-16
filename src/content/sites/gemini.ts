import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Google Gemini
 */
export class GeminiHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "gemini";
  readonly displayName = "Gemini";

  private readonly selectors = {
    // Gemini's rich text input
    textarea:
      'rich-textarea div[contenteditable="true"], div.ql-editor[contenteditable="true"], div[contenteditable="true"][aria-label*="prompt"], div[contenteditable="true"][aria-label*="message"]',
    // Fallback to any contenteditable in the input area
    textareaFallback: '.input-area div[contenteditable="true"], textarea',
    // Submit button
    submitButton:
      'button[aria-label*="Send"], button.send-button, button[mattooltip*="Send"]',
    // Container
    container: ".input-area, form, main",
  };

  matches(url: string): boolean {
    return /^https:\/\/gemini\.google\.com/.test(url);
  }

  getTextarea(): HTMLElement | null {
    let textarea = document.querySelector<HTMLElement>(this.selectors.textarea);
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.textareaFallback
      );
    }
    return textarea;
  }

  getInputText(): string {
    const textarea = this.getTextarea();
    if (!textarea) return "";

    if (textarea.getAttribute("contenteditable") === "true") {
      return textarea.innerText?.trim() || "";
    }

    return (textarea as HTMLTextAreaElement).value || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.getAttribute("contenteditable") === "true") {
      textarea.focus();

      // Gemini uses a custom editor, so we need to be careful
      // Try using execCommand first for better compatibility
      document.execCommand("selectAll", false);
      document.execCommand("delete", false);
      document.execCommand("insertText", false, text);

      // Fallback if execCommand didn't work
      if (!textarea.innerText || textarea.innerText.trim() !== text.trim()) {
        textarea.innerText = text;
      }

      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textarea);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      (textarea as HTMLTextAreaElement).value = text;
    }

    this.triggerInputEvent(textarea);
  }

  getOverlayAnchor(): HTMLElement | null {
    const textarea = this.getTextarea();
    if (textarea) {
      // Find a suitable parent container
      return (
        (textarea.closest(".input-area") as HTMLElement) ||
        (textarea.closest("form") as HTMLElement) ||
        textarea.parentElement
      );
    }
    return document.querySelector<HTMLElement>(this.selectors.container);
  }

  getSubmitButton(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.selectors.submitButton);
  }
}
