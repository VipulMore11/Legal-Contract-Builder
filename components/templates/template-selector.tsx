"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Library,
  Search,
  FileText,
  Briefcase,
  Scale,
  Users,
  DollarSign,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTemplates } from "@/lib/storage";
import type { Template } from "@/types/template";

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Business: Briefcase,
  Legal: Scale,
  HR: Users,
  Finance: DollarSign,
  "Real Estate": Home,
  Other: FileText,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateSelectorProps {
  /** Called when the user picks a template — parent converts it to a contract */
  onSelectTemplate: (template: Template) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];

  const filtered = templates.filter((t) => {
    const matchCat = selectedCategory === "All" || t.category === selectedCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Contract Templates</h1>
        <p className="text-muted-foreground mt-1.5">
          Pick a template — it opens in the Contract Builder where you can fill in the details and customise it.
        </p>
      </div>

      {/* ── Search + category filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  selectedCategory === cat
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Library className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-foreground">No templates found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or category.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((template) => {
            const Icon = CATEGORY_ICONS[template.category] ?? FileText;
            const varCount = template.variables?.length ?? 0;

            return (
              <div
                key={template.id}
                className="group bg-card rounded-xl border border-border hover:border-primary/50 transition-all hover:shadow-lg flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{template.name}</h3>
                      <span className="text-[10px] text-muted-foreground">{template.category}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {template.description || "No description provided."}
                  </p>

                  {/* Variable fields preview */}
                  {varCount > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded-full">
                          {varCount} fields auto-detected
                        </span>
                        {template.builtIn && (
                          <span className="text-[10px] text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 5).map((v) => (
                          <span key={v.name} className="text-[9px] font-mono text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">
                            {v.label}
                          </span>
                        ))}
                        {varCount > 5 && (
                          <span className="text-[9px] text-muted-foreground/50">+{varCount - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="px-5 pb-5">
                  <Button
                    onClick={() => onSelectTemplate(template)}
                    className="w-full gap-2 text-sm"
                  >
                    <Library className="w-4 h-4" />
                    Use Template
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
