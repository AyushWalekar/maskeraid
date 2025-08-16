import type { SupportedSite } from "../../shared/types";

/**
 * Abstract base class for site-specific handlers
 * Each LLM site needs its own handler due to different DOM structures
 */
export abstract class BaseSiteHandler {
  abstract readonly siteName: SupportedSite;
  abstract readonly displayName: string;

  /**
   * Check if this handler matches the current URL
   */
  abstract matches(url: string): boolean;

  /**
   * Get the main textarea/input element
   */
  abstract getTextarea(): HTMLElement | null;

  /**
   * Get the current input text from the textarea
   */
  abstract getInputText(): string;

  /**
   * Set the input text in the textarea
   */
  abstract setInputText(text: string): void;

  /**
   * Get an anchor element to position the overlay button near
   */
  abstract getOverlayAnchor(): HTMLElement | null;

  /**
   * Get the submit button (for optional send interception)
   */
  abstract getSubmitButton(): HTMLElement | null;

  /**
   * Initialize the handler (set up observers, etc.)
   */
  init(): void {
    // Override in subclasses if needed
  }

  /**
   * Clean up (remove observers, etc.)
   */
  destroy(): void {
    // Override in subclasses if needed
  }

  /**
   * Wait for the textarea element to appear
   */
  protected waitForElement(
    selector: string,
    timeout = 10000
  ): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Trigger an input event to ensure React/framework state updates
   */
  protected triggerInputEvent(element: HTMLElement): void {
    const inputEvent = new Event("input", { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);

    // Also dispatch change event for some frameworks
    const changeEvent = new Event("change", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(changeEvent);
  }
}
