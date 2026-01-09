import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Microsoft Copilot (copilot.microsoft.com) and Bing Chat
 */
export class CopilotHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "copilot";
  readonly displayName = "Microsoft Copilot";

  private readonly selectors = {
    // Microsoft Copilot textarea with placeholder "Message Copilot"
    textarea:
      'textarea[placeholder*="Message Copilot"], textarea.userInput, textarea[placeholder*="message"], textarea[aria-label*="Ask"]',
    // Bing Chat specific
    bingTextarea:
      'textarea[name="searchbox"], textarea#searchbox, textarea.cib-serp-main',
    // Contenteditable fallback (some versions)
    contenteditableFallback:
      'div[contenteditable="true"][role="textbox"], div[contenteditable="true"]',
    // Submit button
    submitButton:
      'button[aria-label="Submit"], button[aria-label="Send"], button.submit-button, button[type="submit"]',
    // Container
    container: "form, main, .chat-container",
  };

  matches(url: string): boolean {
    return /^https:\/\/(copilot\.microsoft\.com|www\.bing\.com\/(chat|copilot))/.test(
      url
    );
  }

  getTextarea(): HTMLElement | null {
    let textarea = document.querySelector<HTMLElement>(this.selectors.textarea);
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.bingTextarea
      );
    }
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.contenteditableFallback
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
