import type {
  SanitizationRule,
  SanitizationResult,
  AppliedRule,
  ReplacementMap,
} from "./types";

/**
 * Apply all enabled sanitization rules to the input text
 */
export function sanitize(
  text: string,
  rules: SanitizationRule[]
): SanitizationResult {
  const enabledRules = rules.filter((r) => r.enabled);
  let sanitizedText = text;
  const appliedRules: AppliedRule[] = [];

  for (const rule of enabledRules) {
    const { newText, matches, replacementMap } = applyRule(sanitizedText, rule);
    if (matches.length > 0) {
      appliedRules.push({
        rule,
        matchCount: matches.length,
        matches,
        replacementMap,
      });
      sanitizedText = newText;
    }
  }

  return {
    originalText: text,
    sanitizedText,
    appliedRules,
    hasChanges: sanitizedText !== text,
  };
}

/**
 * Preview sanitization without storing result
 * Same as sanitize but named differently for semantic clarity
 */
export function previewSanitization(
  text: string,
  rules: SanitizationRule[]
): SanitizationResult {
  return sanitize(text, rules);
}

/**
 * Apply a single rule to text
 */
function applyRule(
  text: string,
  rule: SanitizationRule
): { newText: string; matches: string[]; replacementMap: ReplacementMap } {
  const matches: string[] = [];
  const replacementMap: ReplacementMap = {};

  if (rule.isRegex) {
    try {
      const flags = rule.flags || "g";
      const regexForMatching = new RegExp(rule.pattern, flags);

      // Find all matches first
      let match;
      while ((match = regexForMatching.exec(text)) !== null) {
        matches.push(match[0]);
        // Prevent infinite loop for zero-length matches
        if (match[0].length === 0) {
          regexForMatching.lastIndex++;
        }
      }

      // Get distinct values
      const distinctValues = [...new Set(matches)];

      // Create replacement map for distinct values
      let newText = text;
      distinctValues.forEach((value, index) => {
        const indexedReplacement = `${rule.replacement}_${index + 1}`;
        replacementMap[value] = indexedReplacement;
        const valueRegex = new RegExp(
          escapeRegExp(value),
          flags.includes("i") ? "gi" : "g"
        );
        newText = newText.replace(valueRegex, indexedReplacement);
      });

      return { newText, matches, replacementMap };
    } catch (e) {
      console.error("Invalid regex pattern:", rule.pattern, e);
      return { newText: text, matches: [], replacementMap: {} };
    }
  } else {
    // Literal string replacement (case-sensitive, global)
    let newText = text;
    let index = 0;

    while ((index = newText.indexOf(rule.pattern, index)) !== -1) {
      matches.push(rule.pattern);
      index += rule.pattern.length;
    }

    // For literal replacement, all matches are the same value
    if (matches.length > 0) {
      const indexedReplacement = `${rule.replacement}_1`;
      replacementMap[rule.pattern] = indexedReplacement;
      newText = text.split(rule.pattern).join(indexedReplacement);
    }

    return { newText, matches, replacementMap };
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate a regex pattern
 */
export function validatePattern(
  pattern: string,
  isRegex: boolean
): { valid: boolean; error?: string } {
  if (!pattern) {
    return { valid: false, error: "Pattern cannot be empty" };
  }

  if (isRegex) {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  return { valid: true };
}

/**
 * Test a pattern against sample text
 */
export function testPattern(
  text: string,
  pattern: string,
  isRegex: boolean,
  flags?: string
): { matches: string[]; count: number } {
  const matches: string[] = [];

  if (!pattern || !text) {
    return { matches: [], count: 0 };
  }

    if (isRegex) {
      try {
        const regex = new RegExp(pattern, flags || "g");
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push(match[0]);
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } catch {
        // Invalid regex
      }
    } else {
    let index = 0;
    while ((index = text.indexOf(pattern, index)) !== -1) {
      matches.push(pattern);
      index += pattern.length;
    }
  }

  return { matches, count: matches.length };
}

/**
 * Common PII patterns for preset rules
 */
export const COMMON_PATTERNS = {
  email: {
    name: "Email Addresses",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    replacement: "[EMAIL]",
    isRegex: true,
    flags: "gi",
    category: "PII",
  },
  phone: {
    name: "Phone Numbers (US)",
    pattern: "\\b(?:\\+1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}\\b",
    replacement: "[PHONE]",
    isRegex: true,
    flags: "g",
    category: "PII",
  },
  ssn: {
    name: "Social Security Number",
    pattern: "\\b\\d{3}[-]?\\d{2}[-]?\\d{4}\\b",
    replacement: "[SSN]",
    isRegex: true,
    flags: "g",
    category: "PII",
  },
  creditCard: {
    name: "Credit Card Number",
    pattern: "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b",
    replacement: "[CREDIT_CARD]",
    isRegex: true,
    flags: "g",
    category: "Financial",
  },
  ipAddress: {
    name: "IP Address",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    replacement: "[IP_ADDRESS]",
    isRegex: true,
    flags: "g",
    category: "Technical",
  },
  apiKey: {
    name: "API Key (Generic)",
    pattern:
      "(?:api[_-]?key|apikey|api[_-]?token)\\s*[:=]\\s*[\"']?([a-zA-Z0-9_-]{20,})[\"']?",
    replacement: "[API_KEY]",
    isRegex: true,
    flags: "gi",
    category: "Technical",
  },
} as const;
