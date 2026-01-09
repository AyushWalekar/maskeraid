import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Perplexity AI (perplexity.ai)
 * Perplexity uses a contenteditable div with role="textbox"
 */
export class PerplexityHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "perplexity";
  readonly displayName = "Perplexity";

  private readonly selectors = {
    // Perplexity uses a contenteditable div with role="textbox"
    textbox: 'div[role="textbox"][contenteditable="true"], div.textbox[contenteditable="true"]',
    // Fallback selectors
    textareaFallback: 'div[contenteditable="true"].overflow-auto, textarea',
    // Submit button
    submitButton:
      'button[aria-label="Submit"], button[aria-label="Send"], button[type="submit"]',
    // Container
    container: "form, main",
  };

  matches(url: string): boolean {
    return /^https:\/\/(www\.)?perplexity\.ai/.test(url);
  }

  getTextarea(): HTMLElement | null {
    let textarea = document.querySelector<HTMLElement>(this.selectors.textbox);
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

    if (textarea.tagName.toLowerCase() === "textarea") {
      return (textarea as HTMLTextAreaElement).value || "";
    }

    if (textarea.getAttribute("contenteditable") === "true") {
      return this.getContentEditableText(textarea);
    }

    return textarea.innerText || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.tagName.toLowerCase() === "textarea") {
      const textareaEl = textarea as HTMLTextAreaElement;
      textareaEl.focus();

      // Use native setter to bypass React's controlled component
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(textareaEl, text);
      } else {
        textareaEl.value = text;
      }

      this.triggerInputEvent(textareaEl);
      return;
    }

    if (textarea.getAttribute("contenteditable") === "true") {
      textarea.focus();

      // Select all existing content
      document.execCommand("selectAll", false);
      
      // Insert the new text using execCommand (works better with React)
      document.execCommand("insertText", false, text);

      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textarea);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  getOverlayAnchor(): HTMLElement | null {
    const textarea = this.getTextarea();
    if (textarea) {
      return textarea.closest("form") || textarea.parentElement;
    }
    return document.querySelector<HTMLElement>(this.selectors.container);
  }

  getSubmitButton(): HTMLElement | null {
    return document.querySelector<HTMLElement>(this.selectors.submitButton);
  }

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
