import { ChatGPTHandler } from "./chatgpt";
import { ClaudeHandler } from "./claude";
import { GeminiHandler } from "./gemini";
import { PerplexityHandler } from "./perplexity";
import { NotionHandler } from "./notion";
import { HuggingFaceHandler } from "./huggingface";
import { CopilotHandler } from "./copilot";
import type { BaseSiteHandler } from "./base";

// All available site handlers
const handlers: BaseSiteHandler[] = [
  new ChatGPTHandler(),
  new ClaudeHandler(),
  new GeminiHandler(),
  new PerplexityHandler(),
  new NotionHandler(),
  new HuggingFaceHandler(),
  new CopilotHandler(),
];

/**
 * Get the appropriate handler for the current URL
 */
export function getSiteHandler(
  url: string = window.location.href
): BaseSiteHandler | null {
  return handlers.find((h) => h.matches(url)) || null;
}

/**
 * Get all registered handlers
 */
export function getAllHandlers(): BaseSiteHandler[] {
  return handlers;
}

export { BaseSiteHandler } from "./base";
export { ChatGPTHandler } from "./chatgpt";
export { ClaudeHandler } from "./claude";
export { GeminiHandler } from "./gemini";
export { PerplexityHandler } from "./perplexity";
export { NotionHandler } from "./notion";
export { HuggingFaceHandler } from "./huggingface";
export { CopilotHandler } from "./copilot";
