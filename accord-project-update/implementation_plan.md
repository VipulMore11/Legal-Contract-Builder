# UI Consistency Fixes — Targeted Plan

I've audited every component file. Below are the **specific inconsistencies** I found, grouped by category. Each fix is small and surgical — no sweeping find-and-replace this time.

---

## 1. Text Color Inconsistency (muted/description text)

The dashboard pages use the semantic class `text-muted-foreground` for secondary text. But **template-selector.tsx** uses raw `text-slate-500` instead, which clashes with the light theme.

| File | Line(s) | Current | Fix to |
|------|---------|---------|--------|
| [template-selector.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/templates/template-selector.tsx) | 68, 76, 82, 97, 111, 114, 135, 139, 151, 158, 163 | `text-slate-500` | `text-muted-foreground` |

> **Note**: I will NOT touch builder-page.tsx or contract-editor.tsx — those are the dedicated editor UIs with their own dark-background scheme, and changing them last time broke things.

---

## 2. Input Styling Inconsistency

Search inputs look different across pages:

| Component | Current styling | Issue |
|-----------|----------------|-------|
| [clause-library.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/clauses/clause-library.tsx) L89 | `bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary` | ✅ Good |
| [contract-picker.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/contracts/contract-picker.tsx) L223 | `bg-card border border-border rounded-lg ... focus:ring-2 focus:ring-ring/50 focus:border-ring` | ✅ Good |
| [template-selector.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/templates/template-selector.tsx) L82 | `bg-background ... border border-slate-500 ... focus:ring-2 focus:ring-primary placeholder:text-slate-500` | ❌ Uses `border-slate-500` (harsh, thick border) and `bg-background` instead of `bg-card` |
| [data-model-visualizer.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/data-model/data-model-visualizer.tsx) L102 | `bg-background ... border border-border ... focus:ring-2 focus:ring-primary` | Minor: uses `bg-background` instead of `bg-card` |

**Fix**: Standardize all search inputs to: `bg-card text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground`

---

## 3. Category Filter Pill Inconsistency

| Component | Active pill style | Inactive pill style |
|-----------|------------------|---------------------|
| [clause-library.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/clauses/clause-library.tsx) L96 | `<Button variant="default">` (uses primary bg) | `<Button variant="outline">` |
| [contract-picker.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/contracts/contract-picker.tsx) L188-191 | `bg-primary/20 text-primary border-primary/40` | `bg-card text-muted-foreground border-border` |
| [template-selector.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/templates/template-selector.tsx) L94-97 | `bg-gradient-to-r from-violet-600 to-indigo-600` (violet gradient!) | `bg-card text-slate-500 border border-slate-500` |

**Fix**: Standardize template-selector pills to match contract-picker style: `bg-primary/20 text-primary border-primary/40` for active, `bg-card text-muted-foreground border-border` for inactive.

---

## 4. Card Border Inconsistency

| Component | Card border | Hover border |
|-----------|------------|--------------|
| [clause-library.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/clauses/clause-library.tsx) L110 | `border border-border` | `hover:border-primary` |
| [contract-picker.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/contracts/contract-picker.tsx) L381 | `border border-border` | `hover:border-primary/50` |
| [template-selector.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/templates/template-selector.tsx) L126 | `border border-slate-500` | `hover:border-0` (border disappears on hover — causes layout shift!) |
| [data-model-visualizer.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/data-model/data-model-visualizer.tsx) L119 | `border border-border` | `hover:border-primary` |

**Fix**: Standardize template-selector cards to `border border-border hover:border-primary/50 transition-colors`.

---

## 5. "Use Template" Button Style

The template-selector's main CTA button uses a hardcoded violet gradient:
```
bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-foreground
```

Every other primary action button in the project uses the standard `<Button>` default variant (which renders `bg-primary text-primary-foreground`). This violet gradient clashes with the navy theme.

**Fix**: Change to standard `<Button>` with no custom class override, so it inherits the navy primary.

---

## 6. Template Icon Background

The template card icon container uses `bg-violet-500/15` which clashes with the navy/teal theme.

**Fix**: Change to `bg-primary/10` to match [contracts-list.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/contracts/contracts-list.tsx) L70 which uses `bg-primary/10`.

---

## 7. Badge/Pill Inconsistency in Template Selector

| Element | Current | Issue |
|---------|---------|-------|
| "Built-in" badge (L151) | `text-slate-500 bg-slate-500 border border-slate-500` | Text is invisible (same color as bg!) |
| "fields auto-detected" badge (L147) | `bg-violet-500/10 border border-0` | Violet doesn't match theme + `border border-0` is contradictory |

**Fix**: 
- "Built-in" → `text-muted-foreground bg-secondary border border-border`
- "fields auto-detected" → `text-accent bg-accent/10 border border-accent/30`

---

## 8. Unused Import

[dashboard-layout.tsx](file:///e:/React%20Projects/Accord/accord-project-update/components/layout/dashboard-layout.tsx) L8 still imports `Terminal` from lucide-react (leftover from the removed Contract Runner).

**Fix**: Remove the import.

---

## Summary of Files to Edit

| File | Changes |
|------|---------|
| `template-selector.tsx` | Fix text colors, input styling, category pills, card borders, CTA button, icon bg, badges (~8 targeted edits) |
| `data-model-visualizer.tsx` | Fix input `bg-background` → `bg-card` (1 edit) |
| `dashboard-layout.tsx` | Remove unused `Terminal` import (1 edit) |

> [!IMPORTANT]
> I will **NOT** touch `builder-page.tsx`, `contract-editor.tsx`, or `editor-toolbar.tsx`. Those have a deliberately different dark-theme editor aesthetic with hardcoded hex colors, and modifying them caused breakage last time. The inconsistencies above are only in the **dashboard-side pages** that share the light Lawxy theme.

## Verification

After making changes, I'll visually confirm via the running dev server that all pages render correctly without broken styles.
