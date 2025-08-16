/**
 * Core sanitization rule interface
 * Designed for future cloud sync compatibility
 */
export interface SanitizationRule {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  isRegex: boolean;
  flags?: string;
  enabled: boolean;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  autoSanitize: boolean;
  showOverlay: boolean;
  enabledSites: SupportedSite[];
  theme: "light" | "dark" | "system";
}

/**
 * Supported LLM sites
 */
export type SupportedSite = "chatgpt" | "claude" | "gemini";

/**
 * Full storage schema
 */
export interface StorageSchema {
  rules: SanitizationRule[];
  settings: ExtensionSettings;
  syncMeta?: SyncMetadata;
}

/**
 * Future: Cloud sync metadata
 */
export interface SyncMetadata {
  lastSyncAt: number;
  deviceId: string;
  syncEnabled: boolean;
}

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  originalText: string;
  sanitizedText: string;
  appliedRules: AppliedRule[];
  hasChanges: boolean;
}

/**
 * Details about a rule that was applied
 */
export interface AppliedRule {
  rule: SanitizationRule;
  matchCount: number;
  matches: string[];
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoSanitize: false,
  showOverlay: true,
  enabledSites: ["chatgpt", "claude", "gemini"],
  theme: "system",
};

/**
 * Site URL patterns for matching
 */
export const SITE_PATTERNS: Record<SupportedSite, RegExp> = {
  chatgpt: /^https:\/\/(chat\.openai\.com|chatgpt\.com)/,
  claude: /^https:\/\/claude\.ai/,
  gemini: /^https:\/\/gemini\.google\.com/,
};
