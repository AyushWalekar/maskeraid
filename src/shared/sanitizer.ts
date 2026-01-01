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
  console.log('[SANITIZE] Starting sanitization');
  console.log('[SANITIZE] Original text:', JSON.stringify(text));
  console.log('[SANITIZE] Total rules:', rules.length);

  const enabledRules = rules.filter((r) => r.enabled);
  console.log('[SANITIZE] Enabled rules:', enabledRules.length);

  let sanitizedText = text;
  const appliedRules: AppliedRule[] = [];

  for (const rule of enabledRules) {
    console.log(`[SANITIZE] Applying rule: ${rule.name}`);
    console.log('[SANITIZE] Rule pattern:', rule.pattern);
    console.log('[SANITIZE] Rule isRegex:', rule.isRegex);
    console.log('[SANITIZE] Rule flags:', rule.flags);
    console.log('[SANITIZE] Rule replacement:', rule.replacement);

    const { newText, matches, replacementMap } = applyRule(sanitizedText, rule);

    console.log('[SANITIZE] Matches found:', matches.length);
    console.log('[SANITIZE] Matches:', JSON.stringify(matches));
    console.log('[SANITIZE] Replacement map:', JSON.stringify(replacementMap));

    if (matches.length > 0) {
      console.log('[SANITIZE] Text BEFORE replacement:', JSON.stringify(sanitizedText));
      console.log('[SANITIZE] Text AFTER replacement:', JSON.stringify(newText));
      appliedRules.push({
        rule,
        matchCount: matches.length,
        matches,
        replacementMap,
      });
      sanitizedText = newText;
    } else {
      console.log('[SANITIZE] No matches for this rule');
    }
  }

  console.log('[SANITIZE] Final sanitized text:', JSON.stringify(sanitizedText));
  console.log('[SANITIZE] Has changes:', sanitizedText !== text);

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
    console.log('[APPLY_RULE] Using regex replacement');
    try {
      const flags = rule.flags || "g";
      console.log('[APPLY_RULE] Regex flags:', flags);
      const regexForMatching = new RegExp(rule.pattern, flags);
      console.log('[APPLY_RULE] Regex pattern:', regexForMatching.toString());

      // Find all matches first
      let match;
      while ((match = regexForMatching.exec(text)) !== null) {
        console.log('[APPLY_RULE] Match found:', JSON.stringify(match[0]));
        matches.push(match[0]);
        // Prevent infinite loop for zero-length matches
        if (match[0].length === 0) {
          regexForMatching.lastIndex++;
        }
      }

      // Get distinct values
      const distinctValues = [...new Set(matches)];
      console.log('[APPLY_RULE] Distinct values:', JSON.stringify(distinctValues));

      // Create replacement map for distinct values
      let newText = text;
      distinctValues.forEach((value, index) => {
        const indexedReplacement = `${rule.replacement}_${index + 1}`;
        replacementMap[value] = indexedReplacement;
        console.log('[APPLY_RULE] Replacing:', JSON.stringify(value), 'with:', indexedReplacement);

        const valueRegex = new RegExp(
          escapeRegExp(value),
          flags.includes("i") ? "gi" : "g"
        );
        console.log('[APPLY_RULE] Value regex:', valueRegex.toString());
        const beforeReplace = newText;
        newText = newText.replace(valueRegex, indexedReplacement);
        console.log('[APPLY_RULE] Before:', JSON.stringify(beforeReplace));
        console.log('[APPLY_RULE] After:', JSON.stringify(newText));
      });

      return { newText, matches, replacementMap };
    } catch (e) {
      console.error("Invalid regex pattern:", rule.pattern, e);
      return { newText: text, matches: [], replacementMap: {} };
    }
  } else {
    // Literal string replacement (case-sensitive, global)
    console.log('[APPLY_RULE] Using literal replacement');
    console.log('[APPLY_RULE] Pattern to find:', JSON.stringify(rule.pattern));
    console.log('[APPLY_RULE] Replacement string:', rule.replacement);

    let newText = text;
    let index = 0;

    while ((index = newText.indexOf(rule.pattern, index)) !== -1) {
      matches.push(rule.pattern);
      console.log('[APPLY_RULE] Found pattern at index:', index);
      index += rule.pattern.length;
    }

    console.log('[APPLY_RULE] Total matches found:', matches.length);

    // For literal replacement, all matches are the same value
    if (matches.length > 0) {
      const indexedReplacement = `${rule.replacement}_1`;
      replacementMap[rule.pattern] = indexedReplacement;
      console.log('[APPLY_RULE] Indexed replacement:', indexedReplacement);
      console.log('[APPLY_RULE] Text BEFORE split/join:', JSON.stringify(text));
      console.log('[APPLY_RULE] Split by pattern:', JSON.stringify(text.split(rule.pattern)));
      newText = text.split(rule.pattern).join(indexedReplacement);
      console.log('[APPLY_RULE] Text AFTER split/join:', JSON.stringify(newText));
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
