---
title: Math Item OS — Design Upgrade Proposal
stack: [next15, tailwind4, shadcn, next-themes, katex]
generated_by: gemini-3.1-pro
risk: low-to-medium
scope: tokens + shell + 6 component patches
---

## 1. Audit — current state

- **Tokens**: `apps/web/src/app/globals.css` uses zero Tailwind v4 `@theme` variables. Colors are hardcoded to `slate` (e.g., `bg-slate-50` in `dashboard/shell.tsx:21`). No single source of truth for radius or focus rings.
- **Hierarchy**: `components/items/item-card.tsx` uses custom hover states (`hover:border-slate-300 hover:shadow-md`) instead of a unified card elevation system, causing visual inconsistency across list views.
- **Accessibility**: The clear button in `components/search/search-bar.tsx:26` uses `p-0.5`, resulting in a tap target smaller than 44x44. Focus rings vary wildly (e.g., `focus:ring-slate-400` vs `focus-visible:ring-slate-950` in `Button`).
- **Empty States**: `components/search/search-results.tsx:129` implements a one-off empty state with raw SVGs rather than a composable primitive, duplicating effort for every list view.
- **Math**: KaTeX dark mode rules exist but are bound to `color: inherit`, which works but relies on parent text colors not being muted excessively.

## 2. Design token proposal

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark *));

@theme {
  --color-background: oklch(0.99 0.01 255);
  --color-foreground: oklch(0.15 0.02 255);
  
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.15 0.02 255);
  
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.15 0.02 255);
  
  --color-primary: oklch(0.2 0.05 255);
  --color-primary-foreground: oklch(0.98 0 0);
  
  --color-secondary: oklch(0.96 0.01 255);
  --color-secondary-foreground: oklch(0.2 0.05 255);
  
  --color-muted: oklch(0.96 0.01 255);
  --color-muted-foreground: oklch(0.55 0.02 255);
  
  --color-accent: oklch(0.96 0.01 255);
  --color-accent-foreground: oklch(0.2 0.05 255);
  
  --color-destructive: oklch(0.6 0.15 20);
  --color-destructive-foreground: oklch(0.98 0 0);
  
  --color-border: oklch(0.92 0.01 255);
  --color-input: oklch(0.92 0.01 255);
  --color-ring: oklch(0.2 0.05 255);
  
  --radius-lg: 0.5rem;
  --radius-md: calc(var(--radius-lg) - 2px);
  --radius-sm: calc(var(--radius-md) - 2px);

  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
}

.dark {
  --color-background: oklch(0.15 0.02 255);
  --color-foreground: oklch(0.98 0.01 255);
  
  --color-card: oklch(0.15 0.02 255);
  --color-card-foreground: oklch(0.98 0.01 255);
  
  --color-popover: oklch(0.15 0.02 255);
  --color-popover-foreground: oklch(0.98 0.01 255);
  
  --color-primary: oklch(0.98 0.01 255);
  --color-primary-foreground: oklch(0.2 0.05 255);
  
  --color-secondary: oklch(0.22 0.03 255);
  --color-secondary-foreground: oklch(0.98 0.01 255);
  
  --color-muted: oklch(0.22 0.03 255);
  --color-muted-foreground: oklch(0.65 0.02 255);
  
  --color-accent: oklch(0.22 0.03 255);
  --color-accent-foreground: oklch(0.98 0.01 255);
  
  --color-destructive: oklch(0.4 0.15 20);
  --color-destructive-foreground: oklch(0.98 0 0);
  
  --color-border: oklch(0.22 0.03 255);
  --color-input: oklch(0.22 0.03 255);
  --color-ring: oklch(0.8 0.05 255);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
  
  /* Dark mode: ensure KaTeX formulas are visible */
  .dark .katex,
  .dark .katex .base,
  .dark .katex .strut,
  .dark .katex .mord,
  .dark .katex .mbin,
  .dark .katex .mrel,
  .dark .katex .mopen,
  .dark .katex .mclose,
  .dark .katex .mpunct,
  .dark .katex .minner {
    color: inherit;
  }
}
```

## 3. Component-level patches

### Button (`apps/web/src/components/ui/button.tsx`)

```diff
-  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:focus-visible:ring-slate-300",
+  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
   {
     variants: {
       variant: {
-        default: "bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90",
+        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
-        destructive: "bg-red-500 text-slate-50 shadow-sm hover:bg-red-500/90 dark:bg-red-600 dark:hover:bg-red-600/90",
+        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
-        outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
+        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
-        secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800/80",
+        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
-        ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
+        ghost: "hover:bg-accent hover:text-accent-foreground",
-        link: "text-slate-900 underline-offset-4 hover:underline dark:text-slate-100",
+        link: "text-primary underline-offset-4 hover:underline",
```
**Rationale**: Adopts the semantic tokens defined in `globals.css` to unify the color palette and ensure high contrast focus rings (Accessible/Modern).

### Dashboard Shell (`apps/web/src/components/dashboard/shell.tsx`)

```diff
-        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
+        <main id="main-content" className="flex-1 overflow-y-auto bg-muted/40 p-6">
```
**Rationale**: Uses semantic `muted` color to softly contrast with standard `background` cards, cleaning up hardcoded dark mode overrides (Modern/Clean).

### Item Card (`apps/web/src/components/items/item-card.tsx`)

```diff
       className={cn(
-        "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900",
+        "flex flex-col gap-3 rounded-xl border bg-card text-card-foreground p-4",
         "transition-shadow duration-150",
-        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600",
+        onClick && "cursor-pointer hover:shadow-md hover:border-accent",
-        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
+        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
         className,
       )}
```
**Rationale**: Migrates to semantic `card` tokens and utilizes uniform focus rings, ensuring professional typographic consistency and accessible keyboard navigation (Professional/Accessible).

### Skill Items Panel (`apps/web/src/components/skills/skill-items-panel.tsx`)

```diff
-    <button
-      type="button"
-      onClick={handleClick}
-      disabled={!onItemClick}
-      className={cn(
-        "w-full rounded-lg border border-slate-200 p-3 text-left transition-colors",
-        onItemClick ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50/50" : "cursor-default",
-      )}
-    >
+    <button
+      type="button"
+      onClick={handleClick}
+      disabled={!onItemClick}
+      className={cn(
+        "w-full rounded-lg border bg-card p-3 text-left transition-colors",
+        onItemClick ? "cursor-pointer hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default",
+      )}
+    >
```
**Rationale**: Cleans up one-off blue hover states to use the theme's `accent` color and introduces proper focus-visible states (Clean/Accessible).

### Search Bar (`apps/web/src/components/search/search-bar.tsx`)

```diff
     <button
       type="button"
       onClick={onClick}
-      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
+      className="absolute right-3 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
       aria-label="검색어 지우기"
     >
```
**Rationale**: Fixes the tap target to meet the minimum 44x44px accessibility requirement while adopting semantic hover/focus tokens (Accessible).

### Search Results Empty State (`apps/web/src/components/search/search-results.tsx`)

```diff
 // --- 빈 결과 ---
 function EmptyResults() {
   return (
-    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
+    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-muted-foreground">
-      <svg className="mb-3 h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
+      <svg className="mb-4 h-10 w-10 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
         <circle cx="11" cy="11" r="8" />
         <line x1="21" y1="21" x2="16.65" y2="16.65" />
       </svg>
       <p className="text-sm">검색 결과가 없습니다</p>
     </div>
   );
 }
```
**Rationale**: Enhances visual hierarchy by adding a dashed border boundary and softening the icon contrast, bringing it in line with modern empty state patterns (Clean/Modern).

## 4. New primitives to add (only if justified)

- **Badge**: `pnpm dlx shadcn@latest add badge`
  - *Adopt in*: `apps/web/src/components/items/item-card.tsx` and `apps/web/src/components/search/search-results.tsx` to replace the manual `<span className="rounded-full bg-slate-100...">` elements.
- **Card**: `pnpm dlx shadcn@latest add card`
  - *Adopt in*: `apps/web/src/components/items/item-card.tsx` to replace the manual div-based card structure, unifying border radius and shadows across the app.
- **Skeleton**: `pnpm dlx shadcn@latest add skeleton`
  - *Adopt in*: `apps/web/src/components/search/search-results.tsx` and `apps/web/src/components/skills/skill-items-panel.tsx` to replace `animate-pulse bg-slate-200` blocks.

## 5. Out-of-scope / follow-ups

- Extracting a generic `<EmptyState>` component — better done once we inventory all dashboard empty states, not during a token refresh.
- Refactoring `STATUS_COLOR_MAP` and `DIFFICULTY_BADGE_COLORS` to use shadcn variants — requires altering the shared `@math-item-os/shared/constants` package which is outside UI token scope.
- Typography scale adjustments (`text-[13px]`) outside of the provided patches — requires a deeper audit of all data tables and sidebars.

## 6. Verification plan

- [ ] Run `pnpm -w typecheck` to ensure no component props or class names broke.
- [ ] Run `pnpm -w test` to ensure basic rendering tests pass.
- [ ] Toggle Dark Mode on `/items` and confirm the `DashboardShell` background changes smoothly without flashing white.
- [ ] Verify KaTeX contrast on `/items` in Dark Mode (formulas must not disappear into dark backgrounds).
- [ ] Tab through the UI on `/search` to verify `focus-visible:ring-ring` surrounds buttons and the search bar.
- [ ] Inspect the Search Bar "Clear" button on mobile device simulation to ensure a 44x44px clickable area.
