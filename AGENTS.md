# Agent Guidelines

## Project Overview

Chrome extension for sanitizing PII data before sending to LLMs (ChatGPT, Claude, Gemini). Built with React 19, TypeScript, Vite, and Tailwind CSS v4.

## Build & Development Commands

```bash
npm run dev              # Start dev server (HMR)
npm run build            # Build for production (tsc + vite build + copy assets)
npm run lint             # Run ESLint on all files
npm run preview          # Preview production build
```

### TypeScript Check

```bash
npx tsc --noEmit         # Type check without emitting files
```

### Running Tests

No test framework is currently configured. When adding tests, use a framework that works with Vite (e.g., Vitest) and ensure the test command is added to package.json scripts.

## Code Style Guidelines

### File Structure

- `src/background/` - Service worker for cross-context communication
- `src/content/` - Content scripts for LLM site injection
- `src/content/sites/` - Site-specific handlers (base.ts, chatgpt.ts, claude.ts, gemini.ts)
- `src/popup/` - React popup UI components
- `src/components/ui/` - Reusable UI components (shadcn/ui pattern)
- `src/shared/` - Shared utilities, types, constants, storage, sanitizer
- `src/lib/` - Utility functions (e.g., cn() for class merging)

### Imports

- Use path alias `@/*` for internal imports (e.g., `@/components/ui/button`)
- Group imports: external libraries first, then internal modules
- No default exports unless necessary; prefer named exports
- Use `type` keyword for type-only imports: `import type { SanitizationRule } from '@/shared/types'`

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig.app.json)
- Use interfaces for object shapes with `export interface`
- Use type aliases for unions, primitives, and utility types
- Always provide explicit return types for exported functions
- Use `const` assertions for readonly data: `as const`
- Prefer `Omit` and `Partial` utility types over manual interface extensions
- Use type guards: `(r): r is SanitizationRule => r !== undefined`
- Unknown over any for catch blocks and generic types

### React Components

- Functional components with hooks (no class components)
- Use `interface` for props with explicit typing
- Destructure props in function signature
- State with `useState` hooks, type inferred when possible
- Effects with `useEffect` for side effects, return cleanup function
- Event handlers as arrow functions in component body
- Use `onX` naming for event handler props (e.g., `onSave`, `onCancel`)
- Children via `children` prop or render props pattern

### Naming Conventions

- **Files**: kebab-case for non-component files (`storage.ts`, `sanitizer.ts`), PascalCase for components (`RuleForm.tsx`)
- **Components**: PascalCase (`RuleList`, `Settings`)
- **Functions/Variables**: camelCase (`getRules`, `updateBadge`)
- **Constants**: UPPER_SNAKE_CASE for exported constants (`DEFAULT_SETTINGS`, `EXTENSION_NAME`)
- **Interfaces**: PascalCase with descriptive names (`SanitizationRule`, `ExtensionSettings`)
- **Types**: PascalCase with descriptive names (`SupportedSite`, `StorageSchema`)
- **Private members**: Prefix with `private` or `_` (e.g., `listeners`, `notifyListeners()`)
- **CSS classes**: kebab-case with project prefix (`pii-masker-button`, `pii-masker-modal`)

### Styling

- Tailwind CSS v4 with inline classes
- Use `cn()` utility from `@/lib/utils` to merge classes (clsx + tailwind-merge)
- Radix UI primitives for accessible components
- class-variance-authority (cva) for component variants
- Dark mode support via `dark:` prefix and `prefers-color-scheme` media query
- CSS variables for theming (defined in `src/index.css`)
- Shadow DOM for content script style isolation

### Error Handling

- Use try/catch for operations that may fail (e.g., JSON.parse, new RegExp)
- Log errors with `console.error()` for debugging
- Return error objects for validation: `{ valid: boolean; error?: string }`
- Handle async errors with try/catch or `.catch()` on promises
- Provide user-friendly error messages in UI components
- Graceful degradation when extension context unavailable

### Chrome Extension APIs

- Check for `typeof chrome !== "undefined"` before using chrome APIs
- Use `chrome.storage.local` for persistence
- Use `chrome.runtime.onMessage` for cross-context communication
- Use MutationObserver for DOM changes in content scripts
- Shadow DOM (`mode: "closed"`) for style isolation
- Return `true` in message listeners for async responses

### Formatting & Linting

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line arrays/objects
- No unused variables (`noUnusedLocals: true`, `noUnusedParameters: true`)
- React hooks rules enforced via eslint-plugin-react-hooks
- React Fast Refresh via eslint-plugin-react-refresh

### Comments & Documentation

- JSDoc comments for exported functions and complex logic
- Brief inline comments for non-obvious logic only
- No comments for straightforward code
- Use `// TODO:` or `// FIXME:` for temporary notes

### Storage Pattern

- Singleton pattern for services (e.g., `export const storage = new StorageService()`)
- Subscribe/notify pattern for reactive updates
- Promise-based async API
- Chrome storage with localStorage fallback for dev
- Type-safe storage operations with interfaces

### Site Handler Pattern

- Abstract base class `BaseSiteHandler` in `src/content/sites/base.ts`
- Concrete implementations for each LLM site
- Override abstract methods: `matches()`, `getTextarea()`, `getInputText()`, etc.
- Export handler from `src/content/sites/index.ts`
- Register all handlers in handlers array

### Constants

- Export constants from `src/shared/constants.ts`
- Use `as const` for literal types
- Message types for cross-context communication
- CSS prefix to avoid conflicts
- Z-index for overlay positioning

### Adding New Features

1. Define types in `src/shared/types.ts`
2. Add constants in `src/shared/constants.ts`
3. Implement business logic in `src/shared/` (e.g., sanitizer.ts)
4. Add/update storage methods in `src/shared/storage.ts`
5. Create/update UI components in `src/popup/components/` or `src/components/ui/`
6. For new LLM sites, add handler in `src/content/sites/`
7. Update manifest.json if adding new permissions or host patterns

### Performance

- Debounce input handlers (300ms typical)
- Passive event listeners where appropriate
- Avoid unnecessary re-renders with proper dependency arrays
- Use `useCallback` and `useMemo` for expensive operations
- MutationObserver instead of polling for DOM changes
