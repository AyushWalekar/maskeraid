import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SanitizationRule } from '@/shared/types';
import { Pencil, Trash2, Plus, Code, Type, Search, X } from 'lucide-react';
import { trimStringSafe } from '@/lib/formatUtils';

interface RuleListProps {
  rules: SanitizationRule[];
  totalRuleCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (rule: SanitizationRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

export function RuleList({
  rules,
  totalRuleCount,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: RuleListProps) {
  const [ruleToDelete, setRuleToDelete] = useState<SanitizationRule | null>(null);

  const handleConfirmDelete = () => {
    if (!ruleToDelete) return;
    onDelete(ruleToDelete.id);
    setRuleToDelete(null);
  };

  const hasSearch = searchQuery.trim().length > 0;

  if (totalRuleCount === 0) {
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
      <div className="p-3 border-b shrink-0 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search rules (name or pattern)"
              className="h-8 pl-8 pr-8"
            />
            {hasSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={onAdd} size="sm" className="h-8 shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {rules.length} of {totalRuleCount}
          </span>
          {hasSearch && rules.length === 0 && <span>No matches</span>}
        </div>
      </div>

      {hasSearch && rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <h3 className="font-medium mb-1">No matching rules</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try a different search, or clear the filter.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onSearchChange('')}>
              Clear search
            </Button>
            <Button size="sm" onClick={onAdd}>
              <Plus className="w-4 h-4 mr-1" />
              Add Rule
            </Button>
          </div>
        </div>
      ) : (
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
                            onClick={() => setRuleToDelete(rule)}
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
      )}

      <Dialog
        open={!!ruleToDelete}
        onOpenChange={(open) => {
          if (!open) setRuleToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete rule?</DialogTitle>
            <DialogDescription>
              This will permanently remove the rule from your extension.
            </DialogDescription>
          </DialogHeader>

          {ruleToDelete && (
            <div className="rounded-md border p-3">
              <div className="font-medium text-sm truncate">{ruleToDelete.name}</div>
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                {trimStringSafe(ruleToDelete.pattern, 60)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
