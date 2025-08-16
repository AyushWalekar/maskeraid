import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SanitizationRule } from '@/shared/types';
import { validatePattern, testPattern, COMMON_PATTERNS } from '@/shared/sanitizer';
import { ArrowLeft, AlertCircle, CheckCircle, Wand2 } from 'lucide-react';

interface RuleFormProps {
  rule: SanitizationRule | null;
  onSave: (data: Omit<SanitizationRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const CATEGORIES = ['PII', 'Financial', 'Technical', 'Custom'];

export function RuleForm({ rule, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState(rule?.name || '');
  const [pattern, setPattern] = useState(rule?.pattern || '');
  const [replacement, setReplacement] = useState(rule?.replacement || '');
  const [isRegex, setIsRegex] = useState(rule?.isRegex || false);
  const [flags, setFlags] = useState(rule?.flags || 'g');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [category, setCategory] = useState(rule?.category || '');
  const [testText, setTestText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate pattern on change
    const result = validatePattern(pattern, isRegex);
    setError(result.valid ? null : result.error || null);
  }, [pattern, isRegex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !pattern.trim()) {
      return;
    }

    const validation = validatePattern(pattern, isRegex);
    if (!validation.valid) {
      setError(validation.error || 'Invalid pattern');
      return;
    }

    onSave({
      name: name.trim(),
      pattern,
      replacement,
      isRegex,
      flags: isRegex ? flags : undefined,
      enabled,
      category: category || undefined,
    });
  };

  const applyPreset = (presetKey: keyof typeof COMMON_PATTERNS) => {
    const preset = COMMON_PATTERNS[presetKey];
    setName(preset.name);
    setPattern(preset.pattern);
    setReplacement(preset.replacement);
    setIsRegex(preset.isRegex);
    setFlags(preset.flags);
    setCategory(preset.category);
  };

  const testResult = testText
    ? testPattern(testText, pattern, isRegex, flags)
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCancel}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-semibold">
          {rule ? 'Edit Rule' : 'New Rule'}
        </h2>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Presets */}
        {!rule && (
          <div>
            <Label className="text-xs text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {Object.entries(COMMON_PATTERNS).map(([key, preset]) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(key as keyof typeof COMMON_PATTERNS)}
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Email Addresses"
            required
          />
        </div>

        {/* Pattern Type Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Pattern Type</Label>
            <p className="text-xs text-muted-foreground">
              {isRegex ? 'Regular expression' : 'Literal text match'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Text</span>
            <Switch checked={isRegex} onCheckedChange={setIsRegex} />
            <span className="text-xs text-muted-foreground">Regex</span>
          </div>
        </div>

        {/* Pattern */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="pattern">Pattern *</Label>
            {isRegex && (
              <div className="flex gap-1">
                {['g', 'i', 'm'].map((f) => (
                  <Badge
                    key={f}
                    variant={flags.includes(f) ? 'default' : 'outline'}
                    className="cursor-pointer h-5 px-1.5 text-[10px]"
                    onClick={() => {
                      setFlags(
                        flags.includes(f)
                          ? flags.replace(f, '')
                          : flags + f
                      );
                    }}
                  >
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Input
            id="pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={isRegex ? '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' : 'my-secret-api-key'}
            className={`font-mono text-sm ${error ? 'border-destructive' : ''}`}
            required
          />
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        {/* Replacement */}
        <div className="space-y-1.5">
          <Label htmlFor="replacement">Replacement</Label>
          <Input
            id="replacement"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="[REDACTED]"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to remove matched text
          </p>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Category (Optional)</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center justify-between py-2">
          <Label>Enabled</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Test Area */}
        <div className="space-y-1.5 pt-2 border-t">
          <Label htmlFor="test">Test Pattern</Label>
          <Textarea
            id="test"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter sample text to test your pattern..."
            className="h-20 text-sm"
          />
          {testResult && testText && (
            <div className="flex items-center gap-2 text-xs">
              {testResult.count > 0 ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-600">
                    {testResult.count} match{testResult.count > 1 ? 'es' : ''} found
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600">No matches</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-3 border-t">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!name.trim() || !pattern.trim() || !!error}
        >
          {rule ? 'Save Changes' : 'Create Rule'}
        </Button>
      </div>
    </form>
  );
}
