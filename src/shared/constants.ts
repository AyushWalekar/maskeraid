import type { SanitizationRule } from "./types";

/**
 * Extension constants
 */

export const EXTENSION_NAME = "Maskeraid";
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
export const CSS_PREFIX = "pii-masker";

/**
 * Z-index for overlay elements
 */
export const OVERLAY_Z_INDEX = 2147483647;

/**
 * Default system rules for PII masking
 * These rules are enabled by default on first install
 */
export const DEFAULT_RULES: Omit<
  SanitizationRule,
  "createdAt" | "updatedAt"
>[] = [
  {
    id: "sys-email",
    name: "Email Addresses",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    replacement: "[EMAIL]",
    isRegex: true,
    flags: "gi",
    enabled: true,
    category: "PII",
    isSystem: true,
  },
  {
    id: "sys-phone",
    name: "Phone Numbers",
    pattern: "\\b(?:\\+1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}\\b",
    replacement: "[PHONE]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "PII",
    isSystem: true,
  },
  {
    id: "sys-ssn",
    name: "Social Security Number",
    pattern: "\\b\\d{3}[-]?\\d{2}[-]?\\d{4}\\b",
    replacement: "[SSN]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "PII",
    isSystem: true,
  },
  {
    id: "sys-credit-card",
    name: "Credit Card Number",
    pattern: "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b",
    replacement: "[CREDIT_CARD]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "Financial",
    isSystem: true,
  },
  {
    id: "sys-ip-address",
    name: "IP Address",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    replacement: "[IP_ADDRESS]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "Technical",
    isSystem: true,
  },
  {
    id: "sys-aadhar",
    name: "Aadhar Card Number",
    pattern: "\\b\\d{4}[ -]?\\d{4}[ -]?\\d{4}\\b",
    replacement: "[AADHAR]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "PII",
    isSystem: true,
  },
  {
    id: "sys-pan",
    name: "PAN Card Number",
    pattern: "\\b[A-Z]{5}[0-9]{4}[A-Z]{1}\\b",
    replacement: "[PAN]",
    isRegex: true,
    flags: "g",
    enabled: true,
    category: "PII",
    isSystem: true,
  },
];
