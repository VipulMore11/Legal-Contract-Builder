"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";

import { FontSize } from "@/components/contracts/extensions/font-size";
import { Indent } from "@/components/contracts/extensions/indent";
import { SignatureBlock } from "@/components/contracts/extensions/signature-block";
import EditorToolbar from "@/components/contracts/editor-toolbar";

import {
  getContract,
  saveContract,
  saveVersion,
  restoreVersion,
} from "@/lib/storage";
import type {
  Contract,
  Party,
  ContractVersion,
  ContractStatus,
  ContractType,
  PageMargins,
} from "@/types/contract";
import { CONTRACT_TYPES, STATUS_STYLES } from "@/types/contract";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  GitBranch,
  X,
  Plus,
  RotateCcw,
  Eye,
  EyeOff,
  FileText,
  Tag,
  Users,
  History,
  FileSearch,
  Wand2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

import { buildVariables, formatValue, applyVariablesToTiptapJSON } from "@/lib/template-engine";
import type { TemplateVariable, TemplateData } from "@/types/template";

// ---------------------------------------------------------------------------
// Clause data
// ---------------------------------------------------------------------------

interface Clause {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

const CLAUSES: Clause[] = [
  {
    id: "1",
    title: "Payment Terms",
    category: "Financial",
    description: "Defines payment schedule and methods",
    content:
      "PAYMENT TERMS: Client shall pay Provider [AMOUNT] within [DAYS] days of invoice date. Payment shall be made via [METHOD].",
  },
  {
    id: "2",
    title: "Confidentiality",
    category: "Legal",
    description: "Protects confidential information shared between parties",
    content:
      "CONFIDENTIALITY: Both parties agree to maintain the confidentiality of all proprietary and sensitive information disclosed in connection with this Agreement.",
  },
  {
    id: "3",
    title: "Termination",
    category: "Legal",
    description: "Outlines how and when the agreement can be terminated",
    content:
      "TERMINATION: Either party may terminate this Agreement with [NOTICE PERIOD] days written notice. Upon termination, all obligations cease.",
  },
  {
    id: "4",
    title: "Limitation of Liability",
    category: "Legal",
    description: "Limits financial responsibility in case of disputes",
    content:
      "LIMITATION OF LIABILITY: In no event shall either party be liable for indirect, incidental, or consequential damages arising from this Agreement.",
  },
  {
    id: "5",
    title: "Intellectual Property",
    category: "Legal",
    description: "Defines ownership of created work and materials",
    content:
      "INTELLECTUAL PROPERTY: All work product created under this Agreement shall be the exclusive property of [OWNER].",
  },
  {
    id: "6",
    title: "Non-Compete",
    category: "Legal",
    description: "Prevents parties from competing during and after agreement",
    content:
      "NON-COMPETE: During the term and for [PERIOD] after termination, neither party shall engage in competing activities.",
  },
];

// ---------------------------------------------------------------------------
// Status cycling
// ---------------------------------------------------------------------------

const STATUS_ORDER: ContractStatus[] = ["Draft", "Review", "Signed", "Archived"];

function nextStatus(current: ContractStatus): ContractStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContractEditorProps {
  contractId: string;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ContractEditor({ contractId, onBack }: ContractEditorProps) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [contract, setContract] = useState<Contract | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "clauses" | "versions">("properties");

  // ── Right pane mode ───────────────────────────────────────────────────────
  // "preview" = live preview + variable form  |  "sidebar" = properties/clauses/versions  |  "none" = full-width editor
  const [rightPaneMode, setRightPaneMode] = useState<"none" | "preview" | "sidebar">("preview");

  // ── Variable system ───────────────────────────────────────────────────────
  const [variableData, setVariableData] = useState<TemplateData>({});
  const [rawEditorText, setRawEditorText] = useState("");

  const detectedVariables = useMemo(
    () => buildVariables(rawEditorText),
    [rawEditorText],
  );

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showMarginsDialog, setShowMarginsDialog] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ContractVersion | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [tempMargins, setTempMargins] = useState<PageMargins>({ top: 96, right: 96, bottom: 96, left: 96 });

  // ── Sidebar input state ───────────────────────────────────────────────────
  const [clauseSearch, setClauseSearch] = useState("");
  const [tagInput, setTagInput] = useState("");

  // ── Tiptap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      CharacterCount,
      Placeholder.configure({ placeholder: "Start writing your contract…" }),
      Indent,
      SignatureBlock,
    ],
    editorProps: {
      attributes: { class: "contract-editor-content outline-none" },
    },
    onUpdate: ({ editor }) => {
      setIsDirty(true);
      setRawEditorText(editor.getText());
    },
    immediatelyRender: false,
  });

  // ── Load contract ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contractId) return;
    const c = getContract(contractId);
    if (!c) { onBack(); return; }
    setContract(c);
    setTempMargins({ ...c.pageMargins });
  }, [contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate editor ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !contract) return;
    try {
      editor.commands.setContent(JSON.parse(contract.content));
    } catch {
      editor.commands.setContent(contract.content);
    }
    setIsDirty(false);
    // Initialise variable extraction
    setTimeout(() => setRawEditorText(editor.getText()), 50);
  }, [contract?.id, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core save ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!editor || !contract) return;
    const updated: Contract = {
      ...contract,
      content: JSON.stringify(editor.getJSON()),
      updatedAt: new Date().toISOString(),
    };
    saveContract(updated);
    setContract(updated);
    setIsDirty(false);
  }, [editor, contract]);

  // ── Save version ──────────────────────────────────────────────────────────
  const handleSaveVersion = useCallback(() => {
    if (!editor || !contract) return;
    const words: number = (editor.storage.characterCount as { words?: () => number } | undefined)?.words?.() ?? 0;
    const chars: number = (editor.storage.characterCount as { characters?: () => number } | undefined)?.characters?.() ?? 0;
    saveVersion(contract.id, versionLabel, JSON.stringify(editor.getJSON()), words, chars);
    const refreshed = getContract(contract.id);
    if (refreshed) setContract(refreshed);
    setIsDirty(false);
    setShowVersionDialog(false);
    setVersionLabel("");
  }, [editor, contract, versionLabel]);

  // ── Restore version ───────────────────────────────────────────────────────
  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      if (!contract) return;
      const restored = restoreVersion(contract.id, versionId);
      if (!restored) return;
      setContract(restored);
      if (editor) {
        try { editor.commands.setContent(JSON.parse(restored.content)); }
        catch { editor.commands.setContent(restored.content); }
        setIsDirty(false);
      }
    },
    [contract, editor],
  );

  // ── Title blur ────────────────────────────────────────────────────────────
  const handleTitleBlur = useCallback(
    (newTitle: string) => {
      if (!contract || newTitle === contract.title) return;
      const updated: Contract = { ...contract, title: newTitle };
      saveContract(updated);
      setContract(updated);
    },
    [contract],
  );

  // ── Status cycle ──────────────────────────────────────────────────────────
  const handleStatusCycle = useCallback(() => {
    if (!contract) return;
    const updated: Contract = { ...contract, status: nextStatus(contract.status) };
    saveContract(updated);
    setContract(updated);
    setIsDirty(true);
  }, [contract]);

  // ── Type / status dropdowns ───────────────────────────────────────────────
  const handleTypeChange = useCallback(
    (type: ContractType) => {
      if (!contract) return;
      const updated: Contract = { ...contract, type };
      saveContract(updated);
      setContract(updated);
    },
    [contract],
  );

  const handleStatusChange = useCallback(
    (status: ContractStatus) => {
      if (!contract) return;
      const updated: Contract = { ...contract, status };
      saveContract(updated);
      setContract(updated);
    },
    [contract],
  );

  // ── Tags ──────────────────────────────────────────────────────────────────
  const handleAddTag = useCallback(
    (raw: string) => {
      if (!contract || !raw.trim()) return;
      const newTags = raw.split(",").map((t) => t.trim()).filter(Boolean);
      const merged = Array.from(new Set([...contract.tags, ...newTags]));
      const updated: Contract = { ...contract, tags: merged };
      saveContract(updated);
      setContract(updated);
      setTagInput("");
    },
    [contract],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!contract) return;
      const updated: Contract = { ...contract, tags: contract.tags.filter((t) => t !== tag) };
      saveContract(updated);
      setContract(updated);
    },
    [contract],
  );

  // ── Parties ───────────────────────────────────────────────────────────────
  const handleAddParty = useCallback(() => {
    if (!contract) return;
    const newParty: Party = { id: crypto.randomUUID(), name: "", role: "", email: "", company: "" };
    const updated: Contract = { ...contract, parties: [...contract.parties, newParty] };
    saveContract(updated);
    setContract(updated);
  }, [contract]);

  const handleUpdateParty = useCallback(
    (id: string, field: keyof Party, value: string) => {
      if (!contract) return;
      setContract({ ...contract, parties: contract.parties.map((p) => p.id === id ? { ...p, [field]: value } : p) });
    },
    [contract],
  );

  const handlePartyBlur = useCallback(() => {
    if (!contract) return;
    saveContract(contract);
  }, [contract]);

  const handleRemoveParty = useCallback(
    (id: string) => {
      if (!contract) return;
      const updated: Contract = { ...contract, parties: contract.parties.filter((p) => p.id !== id) };
      saveContract(updated);
      setContract(updated);
    },
    [contract],
  );

  // ── Margins ───────────────────────────────────────────────────────────────
  const handleApplyMargins = useCallback(() => {
    if (!contract) return;
    const updated: Contract = { ...contract, pageMargins: { ...tempMargins } };
    saveContract(updated);
    setContract(updated);
    setShowMarginsDialog(false);
  }, [contract, tempMargins]);

  // ── Clause insert ─────────────────────────────────────────────────────────
  const handleInsertClause = useCallback(
    (clause: Clause) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`<p>${clause.content}</p>`).run();
    },
    [editor],
  );

  // ── Apply variables to document ───────────────────────────────────────────
  const handleApplyVariables = useCallback(() => {
    if (!editor) return;
    const json = editor.getJSON();
    const updated = applyVariablesToTiptapJSON(json, variableData, detectedVariables);
    editor.commands.setContent(updated);
    setVariableData({});
    setTimeout(() => setRawEditorText(editor.getText()), 50);
    setIsDirty(true);
  }, [editor, variableData, detectedVariables]);

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => window.print(), []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredClauses = CLAUSES.filter(
    (c) =>
      c.title.toLowerCase().includes(clauseSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(clauseSearch.toLowerCase()),
  );

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!contract) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading contract…
      </div>
    );
  }

  const pageStyle = {
    paddingTop: contract.pageMargins.top,
    paddingRight: contract.pageMargins.right,
    paddingBottom: contract.pageMargins.bottom,
    paddingLeft: contract.pageMargins.left,
  };

  const hasVariables = detectedVariables.length > 0;
  const filledCount = detectedVariables.filter((v) => variableData[v.name]?.trim()).length;
  const allFilled = hasVariables && filledCount === detectedVariables.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="editor-root flex flex-col h-full overflow-hidden">
      {/* ───────────────────────────── Header ──────────────────────────────── */}
      <header className="no-print flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to contracts">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Editable title */}
        <input
          key={contract.id}
          defaultValue={contract.title}
          onBlur={(e) => handleTitleBlur(e.currentTarget.value)}
          className={cn(
            "text-xl font-semibold bg-transparent border-none outline-none",
            "text-foreground min-w-0 flex-1 max-w-xs truncate",
            "focus:border-b focus:border-primary pb-px",
          )}
          placeholder="Untitled Contract"
        />

        {/* Status badge */}
        <button
          onClick={handleStatusCycle}
          title="Click to change status"
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-75 select-none",
            STATUS_STYLES[contract.status],
          )}
        >
          {contract.status}
        </button>

        <span className="flex-1" />

        {/* Variable badge (when variables detected) */}
        {hasVariables && rightPaneMode !== "preview" && (
          <button
            onClick={() => setRightPaneMode("preview")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary text-primary text-xs font-medium hover:bg-primary/90/25 transition-colors shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {filledCount}/{detectedVariables.length} variables
          </button>
        )}

        {/* Unsaved indicator */}
        {isDirty && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Unsaved
          </span>
        )}

        {/* Preview toggle */}
        <Button
          onClick={() => setRightPaneMode((m) => m === "preview" ? "none" : "preview")}
          size="sm"
          variant={rightPaneMode === "preview" ? "default" : "outline"}
          className={cn(
            "gap-1.5 shrink-0",
            rightPaneMode === "preview" && "bg-primary hover:bg-violet-700 border-violet-600",
          )}
          title="Toggle live preview"
        >
          {rightPaneMode === "preview" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          Preview
        </Button>

        {/* Save */}
        <Button onClick={handleSave} size="sm" variant={isDirty ? "default" : "outline"} className="gap-1.5 shrink-0">
          <Save className="w-4 h-4" />
          Save
        </Button>

        {/* Save Version */}
        <Button onClick={() => setShowVersionDialog(true)} size="sm" variant="outline" className="gap-1.5 shrink-0">
          <GitBranch className="w-4 h-4" />
          Save Version
        </Button>
      </header>

      {/* ───────────────────────────── Toolbar ─────────────────────────────── */}
      <div className="no-print shrink-0">
        <EditorToolbar
          editor={editor}
          onSave={handleSave}
          onSaveVersion={() => setShowVersionDialog(true)}
          onPrint={handlePrint}
          onToggleSidebar={() => setRightPaneMode((m) => m === "sidebar" ? "none" : "sidebar")}
          onMargins={() => {
            setTempMargins({ ...contract.pageMargins });
            setShowMarginsDialog(true);
          }}
          sidebarOpen={rightPaneMode === "sidebar"}
          isDirty={isDirty}
        />
      </div>

      {/* ───────────────────────────── Body ────────────────────────────────── */}
      <div className="editor-body flex flex-1 overflow-hidden">
        {/* ── Editor canvas ── */}
        <div className="editor-scroll-area flex-1 overflow-y-auto bg-secondary">
          <div
            className="page-canvas bg-white text-gray-900 shadow-xl rounded-sm min-h-[1056px] max-w-[816px] mx-auto my-8"
            style={pageStyle}
          >
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* ── Preview pane ── */}
        {rightPaneMode === "preview" && (
          <PreviewPane
            editor={editor}
            variables={detectedVariables}
            variableData={variableData}
            rawEditorText={rawEditorText}
            onVariableChange={(name, val) =>
              setVariableData((prev) => ({ ...prev, [name]: val }))
            }
            onApply={handleApplyVariables}
            onClear={() => setVariableData({})}
          />
        )}

        {/* ── Properties / Clauses / Versions sidebar ── */}
        {rightPaneMode === "sidebar" && (
          <aside className="no-print w-72 border-l border-border bg-card flex flex-col overflow-hidden shrink-0">
            {/* Tab bar */}
            <div className="flex border-b border-border shrink-0">
              {(["properties", "clauses", "versions"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                    activeTab === tab
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#e0e0e0]/20",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "properties" && (
                <PropertiesTab
                  contract={contract}
                  tagInput={tagInput}
                  setTagInput={setTagInput}
                  onTypeChange={handleTypeChange}
                  onStatusChange={handleStatusChange}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onAddParty={handleAddParty}
                  onUpdateParty={handleUpdateParty}
                  onPartyBlur={handlePartyBlur}
                  onRemoveParty={handleRemoveParty}
                />
              )}
              {activeTab === "clauses" && (
                <ClausesTab
                  clauses={filteredClauses}
                  search={clauseSearch}
                  onSearchChange={setClauseSearch}
                  onInsert={handleInsertClause}
                />
              )}
              {activeTab === "versions" && (
                <VersionsTab
                  versions={contract.versions}
                  onView={(v) => setViewingVersion(v)}
                  onRestore={handleRestoreVersion}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─────────────────────── Version preview modal ────────────────────── */}
      {viewingVersion && (
        <VersionPreviewModal
          version={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRestore={(id) => { handleRestoreVersion(id); setViewingVersion(null); }}
        />
      )}

      {/* ───────────────────────── Save version dialog ────────────────────── */}
      {showVersionDialog && (
        <VersionDialog
          label={versionLabel}
          onLabelChange={setVersionLabel}
          onSave={handleSaveVersion}
          onCancel={() => { setShowVersionDialog(false); setVersionLabel(""); }}
        />
      )}

      {/* ─────────────────────── Page margins dialog ──────────────────────── */}
      {showMarginsDialog && (
        <MarginsDialog
          margins={tempMargins}
          onChange={setTempMargins}
          onApply={handleApplyMargins}
          onCancel={() => setShowMarginsDialog(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Pane — the Overleaf-style right panel
// ---------------------------------------------------------------------------

const VARIABLE_TYPE_ICON: Record<string, string> = {
  text: "Aa",
  date: "📅",
  number: "#",
  currency: "$",
  dropdown: "▾",
  signature: "✍",
};

function PreviewPane({
  editor,
  variables,
  variableData,
  rawEditorText,
  onVariableChange,
  onApply,
  onClear,
}: {
  editor: ReturnType<typeof useEditor>;
  variables: TemplateVariable[];
  variableData: TemplateData;
  rawEditorText: string;
  onVariableChange: (name: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [formOpen, setFormOpen] = useState(true);

  const filledCount = variables.filter((v) => variableData[v.name]?.trim()).length;
  const allFilled = variables.length > 0 && filledCount === variables.length;

  // Build preview HTML: get editor HTML and replace {{tokens}}
  const previewHTML = useMemo(() => {
    if (!editor) return "";
    // rawEditorText is the dependency that signals content change
    void rawEditorText;
    let html = editor.getHTML();
    const varMap = new Map(variables.map((v) => [v.name, v]));
    // Replace tokens
    html = html.replace(
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:as\s+"([^"]+)")?\s*\}\}/g,
      (_match, name: string) => {
        const value = variableData[name];
        if (!value) {
          return `<mark class="unfilled-preview-token">{{${name}}}</mark>`;
        }
        const variable = varMap.get(name);
        return variable ? formatValue(value, variable) : value;
      },
    );
    return html;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawEditorText, variableData, variables, editor]);

  return (
    <aside className="no-print w-[420px] border-l border-border bg-card flex flex-col overflow-hidden shrink-0">
      {/* Panel header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-popover border-b border-border">
        <Eye className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">
          Live Preview
        </span>
        {variables.length > 0 && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-medium",
            allFilled
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : "bg-primary/10 text-primary border-primary",
          )}>
            {filledCount}/{variables.length} filled
          </span>
        )}
      </div>

      {/* ── Variable fill form ── */}
      {variables.length > 0 && (
        <div className="shrink-0 border-b border-border bg-popover">
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                Fill in Variables
              </span>
              {allFilled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            {formOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {formOpen && (
            <div className="px-4 pb-3 space-y-2.5 max-h-64 overflow-y-auto">
              {variables.map((v) => (
                <VariableFieldMini
                  key={v.name}
                  variable={v}
                  value={variableData[v.name] ?? ""}
                  onChange={(val) => onVariableChange(v.name, val)}
                />
              ))}

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={onApply}
                  disabled={filledCount === 0}
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-8 bg-primary hover:from-violet-700 hover:to-indigo-700 text-foreground border-0 disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Apply to Document
                </Button>
                <Button
                  onClick={onClear}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground hover:text-muted-foreground"
                  title="Clear all fields"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rendered preview canvas ── */}
      <div className="flex-1 overflow-y-auto bg-[#e0e0e0]">
        <div
          className="bg-white text-gray-900 shadow-lg mx-4 my-4 rounded-sm contract-editor-content"
          style={{
            padding: "48px 52px",
            minHeight: 600,
            fontSize: "11pt",
            lineHeight: 1.7,
            fontFamily: "'Times New Roman', Georgia, serif",
          }}
          dangerouslySetInnerHTML={{ __html: previewHTML || "<p style='color:#9ca3af'>Start writing in the editor to see a live preview here…</p>" }}
        />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Variable field (mini, for the preview pane form)
// ---------------------------------------------------------------------------

function VariableFieldMini({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: string;
  onChange: (v: string) => void;
}) {
  const filled = value.trim().length > 0;

  const inputClass =
    "w-full px-2.5 py-1.5 text-xs bg-accent text-primary-foreground border border-border rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted-foreground";

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="opacity-50 text-[10px]">{VARIABLE_TYPE_ICON[variable.type]}</span>
        {variable.label}
        {filled && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
      </label>

      {variable.type === "date" ? (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : variable.type === "number" ? (
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${variable.label.toLowerCase()}…`} className={inputClass} />
      ) : variable.type === "currency" ? (
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
          <input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className={cn(inputClass, "pl-6")} />
        </div>
      ) : variable.type === "dropdown" && variable.options?.length ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select…</option>
          {variable.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : variable.type === "signature" ? (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type full name as signature…" className={cn(inputClass, "italic")} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${variable.label.toLowerCase()}…`} className={inputClass} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (unchanged from original)
// ---------------------------------------------------------------------------

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground uppercase tracking-widest">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

interface PropertiesTabProps {
  contract: Contract;
  tagInput: string;
  setTagInput: (v: string) => void;
  onTypeChange: (t: ContractType) => void;
  onStatusChange: (s: ContractStatus) => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddParty: () => void;
  onUpdateParty: (id: string, field: keyof Party, value: string) => void;
  onPartyBlur: () => void;
  onRemoveParty: (id: string) => void;
}

function PropertiesTab({
  contract, tagInput, setTagInput, onTypeChange, onStatusChange,
  onAddTag, onRemoveTag, onAddParty, onUpdateParty, onPartyBlur, onRemoveParty,
}: PropertiesTabProps) {
  return (
    <div className="space-y-6">
      <Section icon={<FileText className="w-3.5 h-3.5" />} title="Details">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Contract Type</label>
            <select
              value={contract.type}
              onChange={(e) => onTypeChange(e.target.value as ContractType)}
              className="w-full px-2.5 py-1.5 text-xs bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <select
              value={contract.status}
              onChange={(e) => onStatusChange(e.target.value as ContractStatus)}
              className="w-full px-2.5 py-1.5 text-xs bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {(["Draft", "Review", "Signed", "Archived"] as ContractStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 pt-1 border-t border-border/50">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground font-medium">{formatDate(contract.createdAt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last updated</span>
              <span className="text-foreground font-medium">{formatDate(contract.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={<Tag className="w-3.5 h-3.5" />} title="Tags">
        <div className="space-y-2">
          {contract.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contract.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {tag}
                  <button onClick={() => onRemoveTag(tag)} className="hover:text-destructive transition-colors leading-none" aria-label={`Remove tag ${tag}`}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              type="text" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddTag(tagInput); } }}
              placeholder="Add tags, comma-separated"
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => onAddTag(tagInput)} aria-label="Add tag">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Section>

      <Section icon={<Users className="w-3.5 h-3.5" />} title="Parties">
        <div className="space-y-2.5">
          {contract.parties.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No parties added yet.</p>
          )}
          {contract.parties.map((party) => (
            <PartyCard key={party.id} party={party} onUpdate={onUpdateParty} onBlur={onPartyBlur} onRemove={onRemoveParty} />
          ))}
          <Button variant="outline" size="sm" onClick={onAddParty} className="w-full gap-1.5 text-xs h-7">
            <Plus className="w-3.5 h-3.5" />
            Add Party
          </Button>
        </div>
      </Section>
    </div>
  );
}

function PartyCard({ party, onUpdate, onBlur, onRemove }: {
  party: Party;
  onUpdate: (id: string, field: keyof Party, value: string) => void;
  onBlur: () => void;
  onRemove: (id: string) => void;
}) {
  const fields: { field: keyof Party; placeholder: string; type?: string }[] = [
    { field: "name", placeholder: "Full name" },
    { field: "role", placeholder: "Role (e.g. Client, Provider)" },
    { field: "email", placeholder: "Email address", type: "email" },
    { field: "company", placeholder: "Company / organisation" },
  ];
  return (
    <div className="relative group border border-border rounded-md p-2.5 space-y-1.5 hover:border-border/80 transition-colors">
      <button onClick={() => onRemove(party.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove party">
        <X className="w-3.5 h-3.5" />
      </button>
      {fields.map(({ field, placeholder, type = "text" }) => (
        <input
          key={field} type={type} value={party[field]}
          onChange={(e) => onUpdate(party.id, field, e.target.value)}
          onBlur={onBlur} placeholder={placeholder}
          className="w-full px-2 py-1 text-xs bg-background text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
      ))}
    </div>
  );
}

function ClausesTab({ clauses, search, onSearchChange, onInsert }: {
  clauses: Clause[];
  search: string;
  onSearchChange: (v: string) => void;
  onInsert: (clause: Clause) => void;
}) {
  return (
    <div className="space-y-3">
      <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search clauses…"
        className="w-full px-2.5 py-1.5 text-xs bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
      />
      {clauses.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6 italic">No clauses match your search.</p>
      )}
      {clauses.map((clause) => (
        <div key={clause.id} className="border border-border rounded-md p-3 space-y-2 hover:border-primary/40 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground leading-tight">{clause.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{clause.description}</p>
            </div>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] shrink-0" onClick={() => onInsert(clause)}>Insert</Button>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono leading-relaxed line-clamp-2 bg-[#e0e0e0]/30 rounded px-2 py-1">{clause.content}</p>
        </div>
      ))}
    </div>
  );
}

function VersionsTab({ versions, onView, onRestore }: {
  versions: ContractVersion[];
  onView: (version: ContractVersion) => void;
  onRestore: (id: string) => void;
}) {
  const sorted = [...versions].reverse();
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <History className="w-9 h-9 text-muted-foreground/40" />
        <div>
          <p className="text-xs font-medium text-foreground">No saved versions yet</p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Use "Save Version" in the header to snapshot<br />the current document state.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {sorted.map((v, idx) => (
        <div key={v.id} className="border border-border rounded-md p-3 space-y-2.5 hover:border-primary/40 transition-colors">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0 mt-0.5">v{v.number}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground truncate leading-tight">{v.label}</p>
                {idx === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">latest</span>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(v.createdAt)}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{v.wordCount.toLocaleString()} words · {v.charCount.toLocaleString()} chars</p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 h-6 px-2 text-[10px] gap-1" onClick={() => onView(v)}>
              <Eye className="w-3 h-3" />View
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-6 px-2 text-[10px] gap-1" onClick={() => onRestore(v.id)}>
              <RotateCcw className="w-3 h-3" />Restore
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionPreviewModal({ version, onClose, onRestore }: {
  version: ContractVersion;
  onClose: () => void;
  onRestore: (id: string) => void;
}) {
  const previewEditor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
      Underline, TextStyle, FontSize, Color,
      Highlight.configure({ multicolor: true }), FontFamily,
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Subscript, Superscript, TaskList, TaskItem.configure({ nested: true }),
      Typography, Indent, SignatureBlock,
    ],
    content: (() => { try { return JSON.parse(version.content); } catch { return version.content; } })(),
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="no-print shrink-0 flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">v{version.number}</span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{version.label}</p>
            <p className="text-xs text-muted-foreground">{formatDate(version.createdAt)} · {version.wordCount.toLocaleString()} words · {version.charCount.toLocaleString()} chars</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs border border-border">
          <FileSearch className="w-3 h-3" />Read-only preview
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5"><X className="w-3.5 h-3.5" />Close</Button>
        <Button size="sm" onClick={() => onRestore(version.id)} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Restore this version</Button>
      </div>
      <div className="flex-1 overflow-y-auto bg-secondary py-8">
        <div className="bg-white text-gray-900 shadow-xl rounded-sm min-h-[1056px] max-w-[816px] mx-auto" style={{ padding: 96 }}>
          <EditorContent editor={previewEditor} />
        </div>
      </div>
    </div>
  );
}

function VersionDialog({ label, onLabelChange, onSave, onCancel }: {
  label: string;
  onLabelChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" />Save Version</h2>
          <p className="text-xs text-muted-foreground mt-1">Create a named snapshot of the current document you can restore later.</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Version Label</label>
          <input
            autoFocus type="text" value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            placeholder="e.g. Added payment terms"
            className="w-full px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onSave} className="gap-1.5"><GitBranch className="w-3.5 h-3.5" />Save Version</Button>
        </div>
      </div>
    </div>
  );
}

function MarginsDialog({ margins, onChange, onApply, onCancel }: {
  margins: PageMargins;
  onChange: (m: PageMargins) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const fields: { key: keyof PageMargins; label: string }[] = [
    { key: "top", label: "Top" }, { key: "right", label: "Right" },
    { key: "bottom", label: "Bottom" }, { key: "left", label: "Left" },
  ];
  const toInches = (px: number) => Math.round((px / 96) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Page Margins</h2>
          <p className="text-xs text-muted-foreground mt-1">Enter values in pixels. 96 px&nbsp;≈&nbsp;1 inch at 96 DPI.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground block mb-1">
                {label} <span className="text-[10px] opacity-70">({toInches(margins[key])} in)</span>
              </label>
              <input
                type="number" min={0} max={480} value={margins[key]}
                onChange={(e) => onChange({ ...margins, [key]: Math.max(0, Math.round(Number(e.target.value))) })}
                className="w-full px-2.5 py-1.5 text-sm bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onApply}>Apply Margins</Button>
        </div>
      </div>
    </div>
  );
}
