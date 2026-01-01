import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RuleList } from '@/popup/components/RuleList';
import { RuleForm } from '@/popup/components/RuleForm';
import { Settings } from '@/popup/components/Settings';
import { storage } from '@/shared/storage';
import type { SanitizationRule, ExtensionSettings } from '@/shared/types';
import '@/index.css';

function App() {
  const [rules, setRules] = useState<SanitizationRule[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [editingRule, setEditingRule] = useState<SanitizationRule | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    // Load initial data
    loadData();

    // Subscribe to changes
    const unsubscribe = storage.subscribe((changes) => {
      if (changes.rules) setRules(changes.rules);
      if (changes.settings) setSettings(changes.settings);
    });

    return unsubscribe;
  }, []);

  const loadData = async () => {
    const [loadedRules, loadedSettings] = await Promise.all([
      storage.getRules(),
      storage.getSettings(),
    ]);
    setRules(loadedRules);
    setSettings(loadedSettings);
  };

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

  const handleSaveRule = async (
    ruleData: Omit<SanitizationRule, 'id' | 'createdAt' | 'updatedAt'>
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
          <svg
            className="w-5 h-5 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h1 className="text-lg font-semibold text-foreground">Prompt Sanitizer</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Protect sensitive data before sending to LLMs
        </p>
      </div>

      {/* Content */}
      <Tabs defaultValue="rules" className="flex flex-col mt-4 px-4 flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="rules">
            Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-0 flex-1">
          <RuleList
            rules={rules}
            onAdd={handleAddRule}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 flex-1">
          {settings && (
            <Settings
              settings={settings}
              onUpdate={handleUpdateSettings}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
