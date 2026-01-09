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
      return this.getContentEditableText(textarea);
    }

    return (textarea as HTMLTextAreaElement).value || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.getAttribute("contenteditable") === "true") {
      textarea.focus();

      // Clear existing content
      textarea.innerHTML = "";

      // Handle multi-line text by inserting paragraphs (like Claude)
      // Using execCommand or innerText directly causes extra newlines
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

  /**
   * Extract text from contenteditable preserving line breaks
   */
  private getContentEditableText(element: HTMLElement): string {
    const lines: string[] = [];

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        lines.push(node.textContent || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === "br") {
          lines.push("\n");
        } else if (["p", "div", "li"].includes(tagName)) {
          if (lines.length > 0 && !lines[lines.length - 1].endsWith("\n")) {
            lines.push("\n");
          }
          el.childNodes.forEach(processNode);
          if (!lines[lines.length - 1]?.endsWith("\n")) {
            lines.push("\n");
          }
        } else {
          el.childNodes.forEach(processNode);
        }
      }
    };

    element.childNodes.forEach(processNode);
    return lines.join("").trim();
  }
}
