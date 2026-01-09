import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RuleList } from "@/popup/components/RuleList";
import { RuleForm } from "@/popup/components/RuleForm";
import { Settings } from "@/popup/components/Settings";
import { storage } from "@/shared/storage";
import type { SanitizationRule, ExtensionSettings } from "@/shared/types";
import "@/index.css";

function App() {
  const [rules, setRules] = useState<SanitizationRule[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [editingRule, setEditingRule] = useState<SanitizationRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [ruleSearch, setRuleSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Load initial data
    void storage
      .getAll()
      .then((data) => {
        if (cancelled) return;
        setRules(data.rules);
        setSettings(data.settings);
      })
      .catch((err: unknown) => {
        console.error("Maskeraid: Failed to load data", err);
      });

    // Subscribe to changes
    const unsubscribe = storage.subscribe((changes) => {
      if (changes.rules) setRules(changes.rules);
      if (changes.settings) setSettings(changes.settings);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleAddRule = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEditRule = (rule: SanitizationRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDeleteRule = async (id: string) => {
    await storage.deleteRule(id);
  };

  const handleToggleRule = async (id: string) => {
    await storage.toggleRule(id);
  };

  const handleLoadDefaults = async () => {
    await storage.resetRules();
  };

  const handleSaveRule = async (
    ruleData: Omit<SanitizationRule, "id" | "createdAt" | "updatedAt">
  ) => {
    if (editingRule) {
      await storage.updateRule(editingRule.id, ruleData);
    } else {
      await storage.addRule(ruleData);
    }
    setShowForm(false);
    setEditingRule(null);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const handleUpdateSettings = async (updates: Partial<ExtensionSettings>) => {
    await storage.updateSettings(updates);
  };

  const filteredRules = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    if (!query) return rules;

    return rules.filter((r) => {
      const name = r.name.toLowerCase();
      const pattern = r.pattern.toLowerCase();
      return name.includes(query) || pattern.includes(query);
    });
  }, [rules, ruleSearch]);

  if (showForm) {
    return (
      <div className="w-[480px] min-h-[500px] bg-background">
        <RuleForm
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={handleCancelForm}
        />
      </div>
    );
  }

  return (
    <div className="w-[480px] min-h-[500px] max-h-[600px] bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="/icons/icon512.png"
            alt="LLM Data Mask"
            className="w-8 h-8"
          />
          <h1 className="text-lg font-semibold text-foreground">Maskeraid</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Protect sensitive data before sending to LLMs
        </p>
      </div>

      {/* Content */}
      <Tabs
        defaultValue="rules"
        className="flex flex-col mt-4 px-4 flex-1 min-h-0"
      >
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-0 flex-1">
          <RuleList
            rules={filteredRules}
            totalRuleCount={rules.length}
            searchQuery={ruleSearch}
            onSearchChange={setRuleSearch}
            onAdd={handleAddRule}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
            onLoadDefaults={handleLoadDefaults}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 flex-1">
          {settings && (
            <Settings settings={settings} onUpdate={handleUpdateSettings} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
