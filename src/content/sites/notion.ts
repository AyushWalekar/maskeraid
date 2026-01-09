import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Notion AI (notion.so)
 * Notion uses a complex block-based editor with contenteditable
 */
export class NotionHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "notion";
  readonly displayName = "Notion AI";

  private readonly selectors = {
    // Notion AI chat input (when AI sidebar is open)
    aiInput:
      'div[data-content-editable-leaf="true"], div.notion-ai-composer div[contenteditable="true"]',
    // Main page editor (for AI inline commands)
    pageEditor:
      'div[contenteditable="true"][data-root="true"], div.notion-page-content div[contenteditable="true"]',
    // Fallback
    textareaFallback: 'div[contenteditable="true"]',
    // Submit button
    submitButton:
      'div[role="button"][aria-label*="Send"], button[aria-label*="Send"], div.notion-ai-composer button',
    // Container
    container: ".notion-ai-composer, .notion-page-content, main",
  };

  matches(url: string): boolean {
    return /^https:\/\/(www\.)?notion\.so/.test(url);
  }

  getTextarea(): HTMLElement | null {
    // First try AI composer input
    let textarea = document.querySelector<HTMLElement>(this.selectors.aiInput);
    if (!textarea) {
      // Try page editor
      textarea = document.querySelector<HTMLElement>(this.selectors.pageEditor);
    }
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

    return textarea.innerText || "";
  }

  setInputText(text: string): void {
    const textarea = this.getTextarea();
    if (!textarea) return;

    if (textarea.getAttribute("contenteditable") === "true") {
      textarea.focus();
      textarea.innerHTML = "";

      const lines = text.split("\n");
      lines.forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line || "\u200B";
        textarea.appendChild(p);
      });

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textarea);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    this.triggerInputEvent(textarea);
  }

  getOverlayAnchor(): HTMLElement | null {
    const textarea = this.getTextarea();
    if (textarea) {
      return (
        (textarea.closest(".notion-ai-composer") as HTMLElement) ||
        textarea.parentElement
      );
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
