import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExtensionSettings, SupportedSite } from '@/shared/types';
import { storage } from '@/shared/storage';
import { Download, Upload, ExternalLink } from 'lucide-react';

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdate: (updates: Partial<ExtensionSettings>) => void;
}

const SITE_INFO: Record<SupportedSite, { name: string; url: string }> = {
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com' },
  claude: { name: 'Claude', url: 'https://claude.ai' },
  gemini: { name: 'Gemini', url: 'https://gemini.google.com' },
};

export function Settings({ settings, onUpdate }: SettingsProps) {
  const handleSiteToggle = (site: SupportedSite) => {
    const sites = settings.enabledSites.includes(site)
      ? settings.enabledSites.filter((s) => s !== site)
      : [...settings.enabledSites, site];
    onUpdate({ enabledSites: sites });
  };

  const handleExport = async () => {
    const json = await storage.exportRules();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt-sanitizer-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      try {
        const count = await storage.importRules(text, true);
        alert(`Successfully imported ${count} new rule(s)`);
      } catch (err) {
        alert('Failed to import: Invalid file format');
      }
    };
    input.click();
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
        {/* General Settings */}
        <div>
          <h3 className="font-medium mb-3">General</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-sanitize</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically sanitize before sending
                </p>
              </div>
              <Switch
                checked={settings.autoSanitize}
                onCheckedChange={(checked) =>
                  onUpdate({ autoSanitize: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show overlay button</Label>
                <p className="text-xs text-muted-foreground">
                  Display sanitize button on LLM sites
                </p>
              </div>
              <Switch
                checked={settings.showOverlay}
                onCheckedChange={(checked) =>
                  onUpdate({ showOverlay: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Enabled Sites */}
        <div>
          <h3 className="font-medium mb-3">Enabled Sites</h3>
          <div className="space-y-2">
            {(Object.keys(SITE_INFO) as SupportedSite[]).map((site) => (
              <div
                key={site}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.enabledSites.includes(site)}
                    onCheckedChange={() => handleSiteToggle(site)}
                  />
                  <div>
                    <span className="font-medium text-sm">
                      {SITE_INFO[site].name}
                    </span>
                    <a
                      href={SITE_INFO[site].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {SITE_INFO[site].url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                {settings.enabledSites.includes(site) && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Import/Export */}
        <div>
          <h3 className="font-medium mb-3">Backup & Restore</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleImport}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Import Rules
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Export your rules as JSON for backup or sharing
          </p>
        </div>

        <Separator />

        {/* About */}
        <div>
          <h3 className="font-medium mb-2">About</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Prompt Sanitizer v1.0.0</p>
            <p>Protect sensitive data before sending to LLMs</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
