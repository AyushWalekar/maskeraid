/**
 * Extension constants
 */

export const EXTENSION_NAME = "Prompt Sanitizer";
export const EXTENSION_VERSION = "1.0.0";

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  RULES: "rules",
  SETTINGS: "settings",
  SYNC_META: "syncMeta",
  OVERLAY_POSITIONS: "overlayPositions",
} as const;

/**
 * Message types for cross-context communication
 */
export const MESSAGE_TYPES = {
  GET_RULES: "GET_RULES",
  SANITIZE_TEXT: "SANITIZE_TEXT",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  RULES_UPDATED: "RULES_UPDATED",
} as const;

/**
 * CSS class prefix for injected elements (avoid conflicts)
 */
export const CSS_PREFIX = "pii-sanitizer";

/**
 * Z-index for overlay elements
 */
export const OVERLAY_Z_INDEX = 2147483647;
