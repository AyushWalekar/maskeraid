import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Claude.ai
 */
export class ClaudeHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "claude";
  readonly displayName = "Claude";

  private readonly selectors = {
    // Claude's input field (contenteditable div)
    textarea:
      'div[contenteditable="true"].ProseMirror, div[contenteditable="true"][data-placeholder], fieldset div[contenteditable="true"]',
    // Alternative: the actual textarea if it exists
    textareaFallback: "textarea",
    // Submit button
    submitButton: 'button[aria-label="Send Message"], button[type="submit"]',
    // Container
    container: "fieldset, form, main",
  };

  matches(url: string): boolean {
    return /^https:\/\/claude\.ai/.test(url);
  }

  getTextarea(): HTMLElement | null {
    // Try contenteditable first
    let textarea = document.querySelector<HTMLElement>(this.selectors.textarea);
    if (!textarea) {
      // Fallback to regular textarea
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
      // Get text content, preserving line breaks
      return this.getContentEditableText(textarea);
    }

    return (textarea as HTMLTextAreaElement).value || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.getAttribute("contenteditable") === "true") {
      textarea.focus();

      // Clear and set content
      textarea.innerHTML = "";

      // Handle multi-line text by inserting paragraphs
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
      return (
        textarea.closest("fieldset") ||
        textarea.closest("form") ||
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
