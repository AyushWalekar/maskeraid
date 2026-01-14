import type {
  SanitizationRule,
  ExtensionSettings,
  StorageSchema,
  OverlayPositions,
  OverlayPosition,
} from "./types";
import { DEFAULT_SETTINGS as defaultSettings } from "./types";
import { DEFAULT_RULES } from "./constants";

type StorageChangeCallback = (changes: {
  rules?: SanitizationRule[];
  settings?: ExtensionSettings;
  overlayPositions?: OverlayPositions;
}) => void;

/**
 * Browser storage wrapper with typed operations
 * Abstraction layer for future cloud sync capability
 * Supports Chrome (Chromium-based) and Firefox
 */
class StorageService {
  private listeners: StorageChangeCallback[] = [];

  constructor() {
    const chromeAPI = this.getChromeAPI();
    
    // Listen for storage changes
    if (chromeAPI?.storage?.local?.onChanged?.addListener) {
      chromeAPI.storage.local.onChanged.addListener((...args: unknown[]) => {
        const changes = args[0] as Record<string, { newValue?: unknown; oldValue?: unknown }>;
        const areaName = args[1] as string | undefined;
        
        if (!areaName || areaName === "local") {
          const update: Parameters<StorageChangeCallback>[0] = {};
          if (changes.rules) {
            update.rules = changes.rules.newValue as SanitizationRule[];
          }
          if (changes.settings) {
            update.settings = changes.settings.newValue as ExtensionSettings;
          }
          if (changes.overlayPositions) {
            update.overlayPositions = changes.overlayPositions
              .newValue as OverlayPositions;
          }
          this.notifyListeners(update);
        }
      });
    }
  }

  /**
   * Get the appropriate browser API (chrome or browser)
   */
  private getChromeAPI(): typeof chrome | undefined {
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

  /**
   * Get all sanitization rules
   */
  async getRules(): Promise<SanitizationRule[]> {
    const data = await this.get(["rules"]);
    const rules = data.rules || [];

    if (rules.length === 0) {
      return this.initializeDefaultRules();
    }

    return rules;
  }

  /**
   * Initialize default system rules
   */
  private async initializeDefaultRules(): Promise<SanitizationRule[]> {
    const now = Date.now();
    const defaultRules: SanitizationRule[] = DEFAULT_RULES.map((rule) => ({
      ...rule,
      createdAt: now,
      updatedAt: now,
    }));
    await this.set({ rules: defaultRules });
    return defaultRules;
  }

  /**
   * Add a new rule
   */
  async addRule(
    rule: Omit<SanitizationRule, "id" | "createdAt" | "updatedAt">
  ): Promise<SanitizationRule> {
    const rules = await this.getRules();
    const newRule: SanitizationRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rules.push(newRule);
    await this.set({ rules });
    return newRule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(
    id: string,
    updates: Partial<Omit<SanitizationRule, "id" | "createdAt">>
  ): Promise<SanitizationRule | null> {
    const rules = await this.getRules();
    const index = rules.findIndex((r) => r.id === id);
    if (index === -1) return null;

    rules[index] = {
      ...rules[index],
      ...updates,
      updatedAt: Date.now(),
    };
    await this.set({ rules });
    return rules[index];
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const rules = await this.getRules();
    const filtered = rules.filter((r) => r.id !== id);
    if (filtered.length === rules.length) return false;
    await this.set({ rules: filtered });
    return true;
  }

  /**
   * Toggle a rule's enabled status
   */
  async toggleRule(id: string): Promise<SanitizationRule | null> {
    const rules = await this.getRules();
    const rule = rules.find((r) => r.id === id);
    if (!rule) return null;
    return this.updateRule(id, { enabled: !rule.enabled });
  }

  /**
   * Reorder rules (for priority)
   */
  async reorderRules(ruleIds: string[]): Promise<void> {
    const rules = await this.getRules();
    const ruleMap = new Map(rules.map((r) => [r.id, r]));
    const reordered = ruleIds
      .map((id) => ruleMap.get(id))
      .filter((r): r is SanitizationRule => r !== undefined);
    await this.set({ rules: reordered });
  }

  /**
   * Get extension settings
   */
  async getSettings(): Promise<ExtensionSettings> {
    const data = await this.get(["settings"]);
    const stored = data.settings as Partial<ExtensionSettings> | undefined;
    // Merge to support forward-compatible defaults when new settings are added
    return { ...defaultSettings, ...(stored || {}) };
  }

  /**
   * Update extension settings
   */
  async updateSettings(
    updates: Partial<ExtensionSettings>
  ): Promise<ExtensionSettings> {
    const settings = await this.getSettings();
    const updated = { ...settings, ...updates };
    await this.set({ settings: updated });
    return updated;
  }

  /**
   * Export all rules as JSON
   */
  async exportRules(): Promise<string> {
    const rules = await this.getRules();
    return JSON.stringify(rules, null, 2);
  }

  /**
   * Import rules from JSON
   */
  async importRules(json: string, merge = true): Promise<number> {
    const imported = JSON.parse(json) as SanitizationRule[];
    if (!Array.isArray(imported)) throw new Error("Invalid format");

    if (merge) {
      const existing = await this.getRules();
      const existingIds = new Set(existing.map((r) => r.id));
      const newRules = imported.filter((r) => !existingIds.has(r.id));
      const merged = [...existing, ...newRules];
      await this.set({ rules: merged });
      return newRules.length;
    } else {
      await this.set({ rules: imported });
      return imported.length;
    }
  }

  /**
   * Subscribe to storage changes
   */
  subscribe(callback: StorageChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get full storage data
   */
  async getAll(): Promise<StorageSchema> {
    const data = await this.get(["rules", "settings", "overlayPositions"]);
    const storedSettings = data.settings as Partial<ExtensionSettings> | undefined;
    return {
      rules: data.rules || [],
      settings: { ...defaultSettings, ...(storedSettings || {}) },
      overlayPositions: data.overlayPositions,
    };
  }

  /**
   * Get overlay position for a specific host
   */
  async getOverlayPosition(host: string): Promise<OverlayPosition | null> {
    const data = await this.get(["overlayPositions"]);
    const positions = data.overlayPositions;
    return positions?.[host] || null;
  }

  /**
   * Set overlay position for a specific host
   */
  async setOverlayPosition(
    host: string,
    position: OverlayPosition
  ): Promise<void> {
    const data = await this.get(["overlayPositions"]);
    const positions = data.overlayPositions || {};
    positions[host] = position;
    await this.set({ overlayPositions: positions });
  }

  /**
   * Reset overlay position for a specific host
   */
  async resetOverlayPosition(host: string): Promise<void> {
    const data = await this.get(["overlayPositions"]);
    const positions = data.overlayPositions;
    if (positions?.[host]) {
      delete positions[host];
      // Remove the entire key if no positions left
      if (Object.keys(positions).length === 0) {
        await this.remove(["overlayPositions"]);
      } else {
        await this.set({ overlayPositions: positions });
      }
    }
  }

  /**
   * Reset all overlay positions
   */
  async resetAllOverlayPositions(): Promise<void> {
    await this.remove(["overlayPositions"]);
  }

  /**
   * Delete all rules
   */
  async deleteAllRules(): Promise<void> {
    await this.set({ rules: [] });
  }

  /**
   * Reset settings to default
   */
  async resetSettings(): Promise<void> {
    await this.set({ settings: defaultSettings });
  }

  /**
   * Reset rules to default system rules
   */
  async resetRules(): Promise<void> {
    await this.initializeDefaultRules();
  }

  private remove(keys: string[]): Promise<void> {
    return new Promise((resolve) => {
      const chromeAPI = this.getChromeAPI();
      if (chromeAPI?.storage?.local?.remove) {
        chromeAPI.storage.local.remove(keys, () => resolve());
      } else {
        keys.forEach((key) => {
          localStorage.removeItem(`ext_${key}`);
        });
        resolve();
      }
    });
  }

  private notifyListeners(changes: Parameters<StorageChangeCallback>[0]): void {
    this.listeners.forEach((cb) => cb(changes));
  }

  private get(keys: string[]): Promise<Partial<StorageSchema>> {
    return new Promise((resolve) => {
      const chromeAPI = this.getChromeAPI();
      if (chromeAPI?.storage?.local?.get) {
        chromeAPI.storage.local.get(keys, (result) => {
          resolve(result as Partial<StorageSchema>);
        });
      } else {
        const result: Partial<StorageSchema> = {};
        keys.forEach((key) => {
          const stored = localStorage.getItem(`ext_${key}`);
          if (stored) {
            (result as Record<string, unknown>)[key] = JSON.parse(stored);
          }
        });
        resolve(result);
      }
    });
  }

  private set(data: Partial<StorageSchema>): Promise<void> {
    return new Promise((resolve) => {
      const chromeAPI = this.getChromeAPI();
      if (chromeAPI?.storage?.local?.set) {
        chromeAPI.storage.local.set(data, () => resolve());
      } else {
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(`ext_${key}`, JSON.stringify(value));
        });
        resolve();
      }
    });
  }
}

// Singleton instance
export const storage = new StorageService();
