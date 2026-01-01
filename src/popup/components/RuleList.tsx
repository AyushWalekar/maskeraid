import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SanitizationRule } from '@/shared/types';
import { Pencil, Trash2, Plus, Code, Type } from 'lucide-react';
import { trimStringSafe } from '@/lib/formatUtils';

interface RuleListProps {
  rules: SanitizationRule[];
  onAdd: () => void;
  onEdit: (rule: SanitizationRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

export function RuleList({ rules, onAdd, onEdit, onDelete, onToggle }: RuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
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
        </div>
        <h3 className="font-medium mb-1">No sanitization rules yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create rules to automatically redact sensitive information
        </p>
        <Button onClick={onAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Your First Rule
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-3 border-b shrink-0">
        <Button onClick={onAdd} size="sm" className="w-full">
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          <TooltipProvider delayDuration={200}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-3 rounded-lg border transition-colors ${
                  rule.enabled
                    ? 'bg-card hover:bg-accent/50'
                    : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => onToggle(rule.id)}
                    className="mt-0.5"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {rule.name}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="shrink-0 h-5 px-1.5">
                            {rule.isRegex ? (
                              <Code className="w-3 h-3" />
                            ) : (
                              <Type className="w-3 h-3" />
                            )}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {rule.isRegex ? 'Regex pattern' : 'Literal text'}
                        </TooltipContent>
                      </Tooltip>
                      {rule.category && (
                        <Badge variant="secondary" className="shrink-0 h-5 text-[10px]">
                          {rule.category}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {trimStringSafe(rule.pattern, 20)} → {trimStringSafe(rule.replacement, 20)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(rule)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(rule.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </TooltipProvider>
        </div>
      </ScrollArea>
    </div>
  );
}
