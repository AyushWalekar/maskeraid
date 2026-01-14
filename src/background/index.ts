/**
 * Background service worker for the extension
 * Handles cross-context communication and storage sync
 */

import { storage } from "../shared/storage";
import { MESSAGE_TYPES } from "../shared/constants";

/**
 * Get the appropriate browser API (chrome or browser)
 */
function getBrowserAPI(): typeof chrome | undefined {
  const globalBrowser = (globalThis as { browser?: typeof chrome }).browser;
  const globalChrome = (globalThis as { chrome?: typeof chrome }).chrome;
  
  if (typeof globalBrowser !== "undefined") {
    return globalBrowser as typeof chrome;
  }
  if (typeof globalChrome !== "undefined") {
    return globalChrome;
  }
  return undefined;
}

// Listen for messages from content scripts
const browserAPI = getBrowserAPI();
if (browserAPI?.runtime?.onMessage?.addListener) {
  browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message as { type: string; payload?: unknown }, sendResponse);
    return true; // Keep channel open for async response
  });
}

async function handleMessage(
  message: { type: string; payload?: unknown },
  sendResponse: (response: unknown) => void
) {
  switch (message.type) {
    case MESSAGE_TYPES.GET_RULES: {
      const rules = await storage.getRules();
      sendResponse({ rules });
      break;
    }

    case MESSAGE_TYPES.SANITIZE_TEXT: {
      // Could be used for more complex processing in the future
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: "Unknown message type" });
  }
}

// Listen for installation
if (browserAPI?.runtime?.onInstalled?.addListener) {
  browserAPI.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      // Initialize with default settings
      const settings = await storage.getSettings();
      console.log("Extension installed, settings:", settings);
    }
  });
}

// Log that service worker is active
console.log("Prompt Sanitizer background service worker active");
