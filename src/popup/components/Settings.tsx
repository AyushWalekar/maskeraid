import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExtensionSettings, OverlayMode, SupportedSite } from '@/shared/types';
import { storage } from '@/shared/storage';
import { Download, Upload, ExternalLink, RotateCcw, Info, Trash2, RefreshCw } from 'lucide-react';

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
      } catch {
        alert('Failed to import: Invalid file format');
      }
    };
    input.click();
  };

  const handleResetPositions = async () => {
    if (confirm('Are you sure you want to reset all overlay button positions to default?')) {
      await storage.resetAllOverlayPositions();
      alert('All overlay positions have been reset');
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      await storage.resetSettings();
      alert('All settings have been reset to default');
      window.location.reload();
    }
  };

  const handleDeleteAllRules = async () => {
    if (confirm('Are you sure you want to delete all rules? This cannot be undone.')) {
      await storage.deleteAllRules();
      alert('All rules have been deleted');
      window.location.reload();
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-6">
        {/* General Settings */}
        <div>
          <h3 className="font-medium mb-3">General</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Auto-sanitize</Label>
              <Switch
                checked={settings.autoSanitize}
                onCheckedChange={(checked) =>
                  onUpdate({ autoSanitize: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show overlay button</Label>
              <Switch
                checked={settings.showOverlay}
                onCheckedChange={(checked) =>
                  onUpdate({ showOverlay: checked })
                }
              />
            </div>

            {settings.showOverlay && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Overlay behavior</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[200px]">
                        Smart: Only shows when PII is detected. Always: Always shows but disabled when nothing to sanitize.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={settings.overlayMode}
                  onValueChange={(value) =>
                    onUpdate({ overlayMode: value as OverlayMode })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select behavior" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">
                      Smart (only when PII is detected)
                    </SelectItem>
                    <SelectItem value="always">
                      Always show (disabled when nothing to sanitize)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
          <h3 className="font-medium mb-3 flex items-center gap-1.5">
            Backup & Restore
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px]">
                  Export your rules as JSON for backup or sharing with others.
                </p>
              </TooltipContent>
            </Tooltip>
          </h3>
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
        </div>

        <Separator />

        {/* Overlay Positions */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-1.5">
            Overlay Button
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px]">
                  Reset all overlay button positions to default. You can also right-click the overlay button to reset for the current site.
                </p>
              </TooltipContent>
            </Tooltip>
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleResetPositions}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset All Positions
          </Button>
        </div>

        <Separator />

        {/* Reset & Delete */}
        <div>
          <h3 className="font-medium mb-3">Reset & Delete</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleResetSettings}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reset to Default Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleDeleteAllRules}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete All Rules
            </Button>
          </div>
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
