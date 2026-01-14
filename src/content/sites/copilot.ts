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
      'textarea[placeholder*="Message Copilot"], textarea[placeholder*="Ask Copilot"], textarea.userInput, textarea[placeholder*="message"], textarea[aria-label*="Ask"]',
    // Additional textarea selectors for newer Copilot versions
    textareaExtended: 'textarea[placeholder*="Ask me anything"], textarea[class*="input"], textarea[class*="prompt"]',
    // Bing Chat specific
    bingTextarea:
      'textarea[name="searchbox"], textarea#searchbox, textarea.cib-serp-main',
    // Contenteditable fallback (some versions)
    contenteditableFallback:
      'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][data-testid*="input"], div[contenteditable="true"]',
    // Submit button
    submitButton:
      'button[aria-label="Submit"], button[aria-label="Send"], button.submit-button, button[type="submit"]',
    // Container
    container: "form, main, .chat-container, [class*='chat-container']",
  };

  matches(url: string): boolean {
    // Match Copilot main site, Microsoft Copilot, and Bing Chat
    // Updated to handle various URL patterns and paths
    const copilotPattern = /^https:\/\/copilot\.microsoft\.com\//i;
    const bingChatPattern = /^https:\/\/www\.bing\.com\/(chat|copilot)\//i;
    const m365Pattern = /^https:\/\/(www\.)?microsoft\.com\/(copilot|m365|office)\//i;

    return copilotPattern.test(url) ||
           bingChatPattern.test(url) ||
           m365Pattern.test(url);
  }

  getTextarea(): HTMLElement | null {
    console.log("[CopilotHandler] Searching for textarea...");
    
    let textarea = document.querySelector<HTMLElement>(this.selectors.textarea);
    if (!textarea) {
      console.log("[CopilotHandler] Primary selector failed, trying extended selector");
      textarea = document.querySelector<HTMLElement>(
        this.selectors.textareaExtended
      );
    }
    if (!textarea) {
      console.log("[CopilotHandler] Extended selector failed, trying Bing selector");
      textarea = document.querySelector<HTMLElement>(
        this.selectors.bingTextarea
      );
    }
    if (!textarea) {
      console.log("[CopilotHandler] Bing selector failed, trying contenteditable fallback");
      textarea = document.querySelector<HTMLElement>(
        this.selectors.contenteditableFallback
      );
    }
    
    if (textarea) {
      console.log("[CopilotHandler] Found textarea:", {
        tag: textarea.tagName,
        id: textarea.id,
        className: textarea.className,
        placeholder: textarea.getAttribute('placeholder'),
        ariaLabel: textarea.getAttribute('aria-label')
      });
    } else {
      console.error("[CopilotHandler] Could not find textarea with any selector");
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
      const anchor = textarea.closest("form") || textarea.parentElement;
      console.log("[CopilotHandler] Found overlay anchor:", {
        tag: anchor?.tagName,
        className: anchor?.className
      });
      return anchor;
    }
    
    const fallback = document.querySelector<HTMLElement>(this.selectors.container);
    console.log("[CopilotHandler] Using fallback container:", {
      tag: fallback?.tagName,
      className: fallback?.className
    });
    
    return fallback;
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
