"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/dashboard-layout";
import ContractsList from "@/components/contracts/contracts-list";
import ContractPicker from "@/components/contracts/contract-picker";
import TemplateSelector from "@/components/templates/template-selector";
import ClauseLibrary from "@/components/clauses/clause-library";
import VersionHistory from "@/components/contracts/version-history";
import { Plus, FileText, Library, Sparkles, Loader2, X } from "lucide-react";
import { createNewContract, saveContract } from "@/lib/storage";
import { templateBodyToTiptapJSON } from "@/lib/template-engine";
import { generateContract } from "@/lib/ai-service";
import type { Template } from "@/types/template";

type View = "dashboard" | "picker" | "templates" | "clauses" | "history";

export default function Home() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Opening the builder navigates to its dedicated page
  // ------------------------------------------------------------------

  const openContract = (id: string) => {
    router.push(`/builder/${id}`);
  };

  const handleNewContract = () => {
    const c = createNewContract();
    saveContract(c);
    openContract(c.id);
  };

  /**
   * Convert a Template into a Contract (keeping {{variables}} intact so the
   * builder can auto-detect and fill them) then navigate to the builder.
   */
  const handleSelectTemplate = (template: Template) => {
    const tiptapJSON = templateBodyToTiptapJSON(template.body);
    const c = createNewContract(template.name);
    c.content = JSON.stringify(tiptapJSON);
    saveContract(c);
    openContract(c.id);
  };

  /**
   * Generate a contract from a natural language prompt using AI,
   * then open it in the builder.
   */
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAILoading(true);
    setAIError(null);
    try {
      const res = await generateContract(aiPrompt);
      if (res.error) {
        setAIError(res.error);
        return;
      }
      
      let cleanHtml = res.content.trim();
      if (cleanHtml.startsWith("```html")) {
        cleanHtml = cleanHtml.replace(/^```html\n?/, "").replace(/\n?```$/, "");
      } else if (cleanHtml.startsWith("```")) {
        cleanHtml = cleanHtml.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
      }

      const title = aiPrompt.length > 50 ? aiPrompt.slice(0, 50) + "…" : aiPrompt;
      const c = createNewContract(title);
      c.content = cleanHtml;
      saveContract(c);
      setShowAIModal(false);
      setAIPrompt("");
      openContract(c.id);
    } catch {
      setAIError("Something went wrong. Please try again.");
    } finally {
      setAILoading(false);
    }
  };

  return (
    <>
    <DashboardLayout
      currentView={currentView}
      setCurrentView={(v) => {
        if (v === "editor") { setCurrentView("picker"); return; }
        setCurrentView(v as View);
      }}
      noPadding={false}
    >
      {/* ── Dashboard ──────────────────────────────────────────────── */}
      {currentView === "dashboard" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to Lawsky</h1>
              <p className="text-muted-foreground mt-2">Manage, create, and collaborate on legal documents</p>
            </div>
            <Button onClick={handleNewContract} className="gap-2">
              <Plus className="w-4 h-4" />
              New Contract
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: FileText,  label: "New Contract",      desc: "Start from a blank contract",                  action: handleNewContract,                  primary: true,  ai: false },
              { icon: Sparkles,  label: "Generate with AI",  desc: "Describe your contract in natural language",    action: () => setShowAIModal(true),          primary: false, ai: true  },
              { icon: Library,   label: "Browse Templates",  desc: "Pick a template and fill in the details",       action: () => setCurrentView("templates"),  primary: false, ai: false },
            ].map(({ icon: Icon, label, desc, action, primary, ai }) => (
              <button
                key={label}
                onClick={action}
                className={`p-5 rounded-lg border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  ai
                    ? "bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border-violet-500/30 hover:border-violet-400/50 hover:shadow-violet-500/10"
                    : primary ? "bg-primary/10 border-primary/30 hover:bg-primary/15" : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <Icon className={`w-5 h-5 mb-3 ${ai ? "text-violet-500" : primary ? "text-primary" : "text-muted-foreground"}`} />
                <p className={`font-semibold text-sm ${ai ? "ai-gradient-text" : "text-foreground"}`}>{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          <ContractsList onOpenContract={openContract} />
        </div>
      )}

      {/* ── Contract Picker ─────────────────────────────────────────── */}
      {currentView === "picker" && (
        <ContractPicker onOpenContract={openContract} />
      )}

      {/* ── Templates (pure gallery) ────────────────────────────────── */}
      {currentView === "templates" && (
        <TemplateSelector onSelectTemplate={handleSelectTemplate} />
      )}

      {/* ── Clause Library ──────────────────────────────────────────── */}
      {currentView === "clauses" && <ClauseLibrary />}

      {/* ── Version History ─────────────────────────────────────────── */}
      {currentView === "history" && (
        <VersionHistory
          contractId={null}
          onOpenContract={openContract}
          setCurrentView={setCurrentView as (v: string) => void}
        />
      )}
    </DashboardLayout>

    {/* ── AI Generate Modal ─────────────────────────────────────── */}
    {showAIModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!aiLoading) { setShowAIModal(false); setAIError(null); } }} />
        <div className="relative z-10 bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg ai-glow flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              Generate with AI
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Describe the contract you need in plain language. AI will generate a professional legal document for you.</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">What contract do you need?</label>
            <textarea
              autoFocus
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAIGenerate();
                if (e.key === "Escape" && !aiLoading) { setShowAIModal(false); setAIError(null); }
              }}
              placeholder="e.g. Create a non-disclosure agreement between Acme Corp and Wayne Industries, valid for 3 years, governed by California law…"
              rows={4}
              className="w-full px-3 py-2.5 text-sm bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 placeholder:text-muted-foreground resize-none"
              disabled={aiLoading}
            />
          </div>

          {aiError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <span>⚠</span>
              <p>{aiError}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAIModal(false); setAIError(null); }}
              disabled={aiLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAIGenerate}
              disabled={!aiPrompt.trim() || aiLoading}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 border-0 text-white shadow-lg shadow-violet-500/20"
            >
              {aiLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate Contract</>
              )}
            </Button>
          </div>

          {aiLoading && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="ai-typing-indicator flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">AI is drafting your contract</span>
                <span className="ai-dot" />
                <span className="ai-dot" />
                <span className="ai-dot" />
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
