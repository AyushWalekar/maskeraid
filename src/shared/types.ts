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
  isSystem?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  autoSanitize: boolean;
  showOverlay: boolean;
  /**
   * Overlay visibility behavior:
   * - smart: only show when there's something to sanitize
   * - always: always show (disabled when nothing to sanitize)
   */
  overlayMode: OverlayMode;
  enabledSites: SupportedSite[];
  theme: "light" | "dark" | "system";
}

export type OverlayMode = "smart" | "always";

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
  overlayPositions?: OverlayPositions;
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
 * Map from original matched value to its replacement string
 */
export type ReplacementMap = Record<string, string>;

/**
 * Details about a rule that was applied
 */
export interface AppliedRule {
  rule: SanitizationRule;
  matchCount: number;
  matches: string[];
  replacementMap: ReplacementMap;
}

/**
 * Overlay position for a specific host
 */
export interface OverlayPosition {
  top: number;
  right: number;
}

/**
 * Overlay positions per host (website)
 */
export type OverlayPositions = Record<string, OverlayPosition>;

/**
 * Session state for tracking replacements
 */
export interface ReplacementSession {
  originalText: string;
  sanitizedText: string;
  replacementMaps: ReplacementMap[];
  timestamp: number;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoSanitize: false,
  showOverlay: true,
  overlayMode: "smart",
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
