"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/dashboard-layout";
import ContractsList from "@/components/contracts/contracts-list";
import ContractPicker from "@/components/contracts/contract-picker";
import TemplateSelector from "@/components/templates/template-selector";
import ClauseLibrary from "@/components/clauses/clause-library";
import DataModelVisualizer from "@/components/data-model/data-model-visualizer";
import VersionHistory from "@/components/contracts/version-history";
import { Plus, FileText, Library } from "lucide-react";
import { createNewContract, saveContract } from "@/lib/storage";
import { templateBodyToTiptapJSON } from "@/lib/template-engine";
import type { Template } from "@/types/template";

type View = "dashboard" | "picker" | "templates" | "clauses" | "data-model" | "history";

export default function Home() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<View>("dashboard");

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

  return (
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
              <h1 className="text-3xl font-bold text-foreground">Welcome to lawsky</h1>
              <p className="text-muted-foreground mt-2">Manage, create, and collaborate on legal documents</p>
            </div>
            <Button onClick={handleNewContract} className="gap-2">
              <Plus className="w-4 h-4" />
              New Contract
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: FileText, label: "New Contract",     desc: "Start from a blank contract",                  action: handleNewContract,                  primary: true  },
              { icon: Library,  label: "Browse Templates", desc: "Pick a template and fill in the details",       action: () => setCurrentView("templates"),  primary: false },
            ].map(({ icon: Icon, label, desc, action, primary }) => (
              <button
                key={label}
                onClick={action}
                className={`p-5 rounded-lg border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  primary ? "bg-primary/10 border-primary/30 hover:bg-primary/15" : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <Icon className={`w-5 h-5 mb-3 ${primary ? "text-primary" : "text-muted-foreground"}`} />
                <p className="font-semibold text-foreground text-sm">{label}</p>
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

      {/* ── Data Model ──────────────────────────────────────────────── */}
      {currentView === "data-model" && <DataModelVisualizer />}

      {/* ── Version History ─────────────────────────────────────────── */}
      {currentView === "history" && (
        <VersionHistory
          contractId={null}
          onOpenContract={openContract}
          setCurrentView={setCurrentView as (v: string) => void}
        />
      )}
    </DashboardLayout>
  );
}
