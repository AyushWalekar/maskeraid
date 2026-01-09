import { BaseSiteHandler } from "./base";
import type { SupportedSite } from "../../shared/types";

/**
 * Handler for Hugging Face Spaces (huggingface.co/spaces)
 * HF Spaces can have various chat interfaces (Gradio, Streamlit, etc.)
 */
export class HuggingFaceHandler extends BaseSiteHandler {
  readonly siteName: SupportedSite = "huggingface";
  readonly displayName = "Hugging Face";

  private readonly selectors = {
    // Gradio chat interface (most common)
    gradioTextarea: 'textarea[data-testid="textbox"], textarea.scroll-hide',
    // Gradio chatbot input
    gradioChatInput:
      'div.chat-input textarea, div[class*="chat"] textarea, textarea[placeholder*="message"]',
    // Streamlit chat input
    streamlitInput: 'textarea[aria-label*="chat"], div.stChatInput textarea',
    // Generic fallback
    textareaFallback: "textarea",
    // Contenteditable fallback
    contenteditableFallback: 'div[contenteditable="true"]',
    // Submit buttons (various interfaces)
    submitButton:
      'button[aria-label="Submit"], button.submit, button[type="submit"], button:has(svg[class*="send"])',
    // Container
    container: ".gradio-container, .stApp, main, form",
  };

  matches(url: string): boolean {
    return /^https:\/\/(www\.)?huggingface\.co\/(spaces|chat)/.test(url);
  }

  getTextarea(): HTMLElement | null {
    // Try Gradio textbox first
    let textarea = document.querySelector<HTMLElement>(
      this.selectors.gradioTextarea
    );
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.gradioChatInput
      );
    }
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.streamlitInput
      );
    }
    if (!textarea) {
      textarea = document.querySelector<HTMLElement>(
        this.selectors.textareaFallback
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
      (textarea as HTMLTextAreaElement).value = text;
      this.triggerInputEvent(textarea);
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
      return (
        (textarea.closest(".gradio-container") as HTMLElement) ||
        (textarea.closest("form") as HTMLElement) ||
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
