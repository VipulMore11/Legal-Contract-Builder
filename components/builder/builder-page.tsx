"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  getContract, saveContract, saveVersion, restoreVersion, getContract as refreshContract,
} from "@/lib/storage";
import type { Contract, Party, ContractVersion, ContractStatus, ContractType, PageMargins } from "@/types/contract";
import { CONTRACT_TYPES, STATUS_STYLES } from "@/types/contract";
import { formatDate, cn } from "@/lib/utils";
import { buildVariables, formatValue, applyVariablesToTiptapJSON } from "@/lib/template-engine";
import type { TemplateVariable, TemplateData } from "@/types/template";
import AIChatPanel from "@/components/ai/ai-chat-panel";

import {
  ArrowLeft, Save, GitBranch, X, Plus, RotateCcw, Eye, EyeOff,
  FileText, Tag, Users, History, Wand2, ChevronDown,
  Sparkles, CheckCircle2, Download, ZoomIn, ZoomOut,
  BookOpen, Settings2, FileSearch, CalendarDays, Hash, DollarSign,
  PenLine, Maximize2, Trash2, Type, ImageIcon, PanelRightClose, PanelRightOpen,
} from "lucide-react";

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
  { id: "1", title: "Payment Terms", category: "Financial", description: "Defines payment schedule and methods", content: "PAYMENT TERMS: Client shall pay Provider [AMOUNT] within [DAYS] days of invoice date. Payment shall be made via [METHOD]." },
  { id: "2", title: "Confidentiality", category: "Legal", description: "Protects confidential information shared between parties", content: "CONFIDENTIALITY: Both parties agree to maintain the confidentiality of all proprietary and sensitive information disclosed in connection with this Agreement." },
  { id: "3", title: "Termination", category: "Legal", description: "Outlines how and when the agreement can be terminated", content: "TERMINATION: Either party may terminate this Agreement with [NOTICE PERIOD] days written notice. Upon termination, all obligations cease." },
  { id: "4", title: "Limitation of Liability", category: "Legal", description: "Limits financial responsibility in case of disputes", content: "LIMITATION OF LIABILITY: In no event shall either party be liable for indirect, incidental, or consequential damages arising from this Agreement." },
  { id: "5", title: "Intellectual Property", category: "Legal", description: "Defines ownership of created work and materials", content: "INTELLECTUAL PROPERTY: All work product created under this Agreement shall be the exclusive property of [OWNER]." },
  { id: "6", title: "Non-Compete", category: "Legal", description: "Prevents parties from competing during and after agreement", content: "NON-COMPETE: During the term and for [PERIOD] after termination, neither party shall engage in competing activities." },
];

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const STATUS_ORDER: ContractStatus[] = ["Draft", "Review", "Signed", "Archived"];
function nextStatus(s: ContractStatus): ContractStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
}

// ---------------------------------------------------------------------------
// Panel types
// ---------------------------------------------------------------------------

type PanelId = "ai" | "variables" | "clauses" | "properties" | "history" | "signatures";

const PANEL_META: Record<PanelId, { label: string; icon: React.ElementType }> = {
  ai: { label: "AI Assistant", icon: Sparkles },
  variables: { label: "Variables", icon: Wand2 },
  clauses: { label: "Clauses", icon: BookOpen },
  signatures: { label: "Signatures", icon: PenLine },
  properties: { label: "Properties", icon: Settings2 },
  history: { label: "History", icon: History },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BuilderPage({ contractId }: { contractId: string }) {
  const router = useRouter();

  // ── Contract ──────────────────────────────────────────────────────────────
  const [contract, setContract] = useState<Contract | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Panel state ───────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<PanelId | null>("ai");
  const [showPreview, setShowPreview] = useState(true);
  const PANEL_W = 280;

  // ── Variable system ───────────────────────────────────────────────────────
  const [variableData, setVariableData] = useState<TemplateData>({});
  const [rawEditorText, setRawEditorText] = useState("");
  const detectedVariables = useMemo(() => buildVariables(rawEditorText), [rawEditorText]);

  // ── Preview zoom ──────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(85);

  // ── Splitter ──────────────────────────────────────────────────────────────
  const [splitPct, setSplitPct] = useState(52);
  const isDragging = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showMarginsDialog, setShowMarginsDialog] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [viewingVersion, setViewingVersion] = useState<ContractVersion | null>(null);
  const [tempMargins, setTempMargins] = useState<PageMargins>({ top: 96, right: 96, bottom: 96, left: 96 });

  // ── Sidebar inputs ────────────────────────────────────────────────────────
  const [clauseSearch, setClauseSearch] = useState("");
  const [tagInput, setTagInput] = useState("");

  // ── Tiptap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      // StarterKit excludes extensions we configure separately to avoid duplicates
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        // Disable built-ins that we add manually with custom config
        link: false,
        underline: false,
      }),
      TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
      Underline, TextStyle, FontSize, Color,
      Highlight.configure({ multicolor: true }), FontFamily,
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Subscript, Superscript, TaskList, TaskItem.configure({ nested: true }),
      Typography, CharacterCount,
      Placeholder.configure({ placeholder: "Start writing your contract…" }),
      Indent, SignatureBlock,
    ],
    editorProps: { attributes: { class: "contract-editor-content outline-none min-h-full" } },
    onUpdate: ({ editor }) => {
      setIsDirty(true);
      setRawEditorText(editor.getText());
    },
    immediatelyRender: false,
  });

  // ── Load contract ─────────────────────────────────────────────────────────
  useEffect(() => {
    const c = getContract(contractId);
    if (!c) { router.push("/"); return; }
    setContract(c);
    setTempMargins({ ...c.pageMargins });
  }, [contractId]); // eslint-disable-line

  useEffect(() => {
    if (!editor || !contract) return;
    try { editor.commands.setContent(JSON.parse(contract.content)); }
    catch { editor.commands.setContent(contract.content); }
    setIsDirty(false);
    setTimeout(() => setRawEditorText(editor.getText()), 60);
  }, [contract?.id, editor]); // eslint-disable-line

  // ── Splitter drag ─────────────────────────────────────────────────────────
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const r = splitContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      setSplitPct(Math.min(78, Math.max(22, pct)));
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!editor || !contract) return;
    const updated: Contract = { ...contract, content: JSON.stringify(editor.getJSON()), updatedAt: new Date().toISOString() };
    saveContract(updated);
    setContract(updated);
    setIsDirty(false);
  }, [editor, contract]);

  const handleSaveVersion = useCallback(() => {
    if (!editor || !contract) return;
    const words = (editor.storage.characterCount as { words?: () => number })?.words?.() ?? 0;
    const chars = (editor.storage.characterCount as { characters?: () => number })?.characters?.() ?? 0;
    saveVersion(contract.id, versionLabel || "Unnamed version", JSON.stringify(editor.getJSON()), words, chars);
    const refreshed = refreshContract(contract.id);
    if (refreshed) setContract(refreshed);
    setIsDirty(false);
    setShowVersionDialog(false);
    setVersionLabel("");
  }, [editor, contract, versionLabel]);

  const handleRestoreVersion = useCallback((versionId: string) => {
    if (!contract) return;
    const restored = restoreVersion(contract.id, versionId);
    if (!restored) return;
    setContract(restored);
    if (editor) {
      try { editor.commands.setContent(JSON.parse(restored.content)); }
      catch { editor.commands.setContent(restored.content); }
      setIsDirty(false);
    }
  }, [contract, editor]);

  const handleStatusCycle = useCallback(() => {
    if (!contract) return;
    const updated = { ...contract, status: nextStatus(contract.status) };
    saveContract(updated); setContract(updated);
  }, [contract]);

  const handleTitleBlur = useCallback((v: string) => {
    if (!contract || v === contract.title) return;
    const updated = { ...contract, title: v };
    saveContract(updated); setContract(updated);
  }, [contract]);

  const handleApplyVariables = useCallback(() => {
    if (!editor) return;
    const updated = applyVariablesToTiptapJSON(editor.getJSON(), variableData, detectedVariables);
    editor.commands.setContent(updated);
    setVariableData({});
    setTimeout(() => setRawEditorText(editor.getText()), 60);
    setIsDirty(true);
  }, [editor, variableData, detectedVariables]);

  const handleInsertClause = useCallback((clause: Clause) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<p>${clause.content}</p>`).run();
  }, [editor]);

  const handleTypeChange = useCallback((type: ContractType) => {
    if (!contract) return;
    const u = { ...contract, type }; saveContract(u); setContract(u);
  }, [contract]);
  const handleStatusChange = useCallback((status: ContractStatus) => {
    if (!contract) return;
    const u = { ...contract, status }; saveContract(u); setContract(u);
  }, [contract]);
  const handleAddTag = useCallback((raw: string) => {
    if (!contract || !raw.trim()) return;
    const tags = Array.from(new Set([...contract.tags, ...raw.split(",").map(t => t.trim()).filter(Boolean)]));
    const u = { ...contract, tags }; saveContract(u); setContract(u); setTagInput("");
  }, [contract]);
  const handleRemoveTag = useCallback((tag: string) => {
    if (!contract) return;
    const u = { ...contract, tags: contract.tags.filter(t => t !== tag) }; saveContract(u); setContract(u);
  }, [contract]);
  const handleAddParty = useCallback(() => {
    if (!contract) return;
    const p: Party = { id: crypto.randomUUID(), name: "", role: "", email: "", company: "" };
    const u = { ...contract, parties: [...contract.parties, p] }; saveContract(u); setContract(u);
  }, [contract]);
  const handleUpdateParty = useCallback((id: string, field: keyof Party, value: string) => {
    if (!contract) return;
    setContract({ ...contract, parties: contract.parties.map(p => p.id === id ? { ...p, [field]: value } : p) });
  }, [contract]);
  const handlePartyBlur = useCallback(() => { if (contract) saveContract(contract); }, [contract]);
  const handleRemoveParty = useCallback((id: string) => {
    if (!contract) return;
    const u = { ...contract, parties: contract.parties.filter(p => p.id !== id) }; saveContract(u); setContract(u);
  }, [contract]);
  const handleApplyMargins = useCallback(() => {
    if (!contract) return;
    const u = { ...contract, pageMargins: { ...tempMargins } }; saveContract(u); setContract(u); setShowMarginsDialog(false);
  }, [contract, tempMargins]);

  // ── Preview HTML (defined BEFORE handleExport so it can be referenced) ────
  const previewHTML = useMemo(() => {
    if (!editor) return "";
    void rawEditorText;
    const varMap = new Map(detectedVariables.map(v => [v.name, v]));
    return editor.getHTML().replace(
      /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:as\s+"([^"]+)")?\s*\}\}/g,
      (_m, name: string) => {
        const val = variableData[name];
        if (!val) return `<mark class="unfilled-preview-token">{{${name}}}</mark>`;
        const variable = varMap.get(name);
        return variable ? formatValue(val, variable) : val;
      }
    );
  }, [rawEditorText, variableData, detectedVariables, editor]); // eslint-disable-line

  // ── Export / print ────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!contract) return;
    const win = window.open("", "_blank");
    if (!win) { window.print(); return; }
    const m = contract.pageMargins;
    const toIn = (px: number) => `${px / 96}in`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${contract.title}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.6;color:#111827;
           padding:${toIn(m.top)} ${toIn(m.right)} ${toIn(m.bottom)} ${toIn(m.left)}}
      @page{margin:0}
      p{margin:0 0 0.6em}
      h1{font-size:2em;font-weight:700;margin:1em 0 0.5em;text-align:center}
      h2{font-size:1.5em;font-weight:700;margin:0.9em 0 0.45em}
      h3{font-size:1.25em;font-weight:600;margin:0.8em 0 0.4em}
      ul{list-style:disc;padding-left:1.5em;margin:0.4em 0 0.6em}
      ol{list-style:decimal;padding-left:1.5em;margin:0.4em 0 0.6em}
      li{margin-bottom:0.2em}
      blockquote{border-left:3px solid #9ca3af;margin:0.8em 0;padding-left:1em;color:#4b5563;font-style:italic}
      table{border-collapse:collapse;width:100%;margin:0.8em 0}
      th{background:#f3f4f6;font-weight:600;text-align:left;border:1px solid #d1d5db;padding:8px 12px}
      td{border:1px solid #d1d5db;padding:7px 12px}
      mark{background:transparent;color:inherit}
    </style></head><body>${previewHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  }, [contract, previewHTML]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filledCount = detectedVariables.filter(v => variableData[v.name]?.trim()).length;
  const hasVars = detectedVariables.length > 0;
  const allFilled = hasVars && filledCount === detectedVariables.length;
  const filteredClauses = CLAUSES.filter(c =>
    c.title.toLowerCase().includes(clauseSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(clauseSearch.toLowerCase())
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (!contract) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const pageStyle = {
    paddingTop: contract.pageMargins.top,
    paddingRight: contract.pageMargins.right,
    paddingBottom: contract.pageMargins.bottom,
    paddingLeft: contract.pageMargins.left,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" style={{ fontFamily: "var(--font-sans)" }}>

      {/* ═══════════════════════════ TOP BAR ════════════════════════════════ */}
      <header className="no-print flex items-center gap-2 h-11 px-3 bg-card border-b border-border shrink-0 z-10">
        {/* Back */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs shrink-0"
          title="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Lawsky</span>
        </button>

        <div className="w-px h-5 bg-accent shrink-0" />

        {/* Editable title */}
        <input
          key={contract.id}
          defaultValue={contract.title}
          onBlur={(e) => handleTitleBlur(e.currentTarget.value)}
          className="text-sm font-semibold bg-transparent text-foreground border border-input min-w-0 flex-1 max-w-xs truncate placeholder:text-muted-foreground focus:bg-accent px-2 py-1 rounded-md transition-colors"
          placeholder="Untitled Contract"
        />

        {/* Status badge */}
        <button
          onClick={handleStatusCycle}
          className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-75 shrink-0", STATUS_STYLES[contract.status])}
        >
          {contract.status}
        </button>

        <div className="flex-1" />

        {/* Variable badge */}
        {hasVars && (
          <button
            onClick={() => setActivePanel(p => p === "variables" ? null : "variables")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all shrink-0",
              allFilled
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-primary/10 text-primary border-primary animate-pulse"
            )}
          >
            <Wand2 className="w-3 h-3" />
            {filledCount}/{detectedVariables.length} variables
          </button>
        )}

        {/* Unsaved dot */}
        {isDirty && (
          <span className="flex items-center gap-1.5 text-[11px] text-amber-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Unsaved
          </span>
        )}

        {/* Save Version */}
        <button
          onClick={() => setShowVersionDialog(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-foreground bg-secondary hover:text-foreground hover:bg-secondary/80 border border-transparent hover:border-border transition-all text-xs shrink-0"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Version</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0",
            isDirty
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
          )}
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-medium transition-all shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export PDF</span>
        </button>

        {/* Toggle Preview (Split-screen) */}
        <button
          onClick={() => setShowPreview(p => !p)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all shrink-0",
            showPreview
              ? "bg-secondary hover:bg-secondary/80 text-foreground border-border"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent animate-pulse"
          )}
          title={showPreview ? "Hide Live Preview" : "Show Live Preview"}
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
        </button>
      </header>

      {/* ═══════════════════════════ BODY ═══════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ────────────── ACTIVITY BAR (icon strip) ──────────────────────── */}
        <aside className="no-print flex flex-col items-center py-2 gap-1 bg-card border-r border-border w-12 shrink-0">
          {(Object.entries(PANEL_META) as [PanelId, { label: string; icon: React.ElementType }][]).map(([id, { label, icon: Icon }]) => {
            const isActive = activePanel === id;
            const hasBadge = id === "variables" && hasVars && !allFilled;
            return (
              <button
                key={id}
                title={label}
                onClick={() => setActivePanel(p => p === id ? null : id)}
                className={cn(
                  "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all group",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {hasBadge && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
                <span className="absolute left-12 bg-popover text-foreground text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-xl">
                  {label}
                </span>
              </button>
            );
          })}

          <div className="w-6 h-px bg-accent my-1" />

          {/* Toggle preview */}
          <button
            title={showPreview ? "Hide preview" : "Show preview"}
            onClick={() => setShowPreview(p => !p)}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all group relative",
              showPreview ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {showPreview ? <PanelRightClose className="w-[16px] h-[16px]" /> : <PanelRightOpen className="w-[16px] h-[16px]" />}
            <span className="absolute left-12 bg-popover text-foreground text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-xl">
              {showPreview ? "Hide Preview" : "Show Preview"}
            </span>
          </button>

          <div className="flex-1" />

          {/* Margins */}
          <button
            title="Page Margins"
            onClick={() => { setTempMargins({ ...contract.pageMargins }); setShowMarginsDialog(true); }}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all group relative"
          >
            <Maximize2 className="w-[16px] h-[16px]" />
            <span className="absolute left-12 bg-popover text-foreground text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-xl">
              Page Margins
            </span>
          </button>
        </aside>

        {/* ────────────── SIDE PANEL (slides in/out) ─────────────────────── */}
        <div
          className="no-print border-r border-border bg-card shrink-0 overflow-hidden transition-all duration-200"
          style={{ width: activePanel ? PANEL_W : 0 }}
        >
          <div className="flex flex-col h-full" style={{ width: PANEL_W }}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                {activePanel ? PANEL_META[activePanel].label : ""}
              </span>
              <button
                onClick={() => setActivePanel(null)}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {activePanel === "ai" && (
                <AIChatPanel
                  editor={editor}
                  documentText={rawEditorText}
                />
              )}
              {activePanel === "variables" && (
                <VariablesPanel
                  variables={detectedVariables}
                  variableData={variableData}
                  filledCount={filledCount}
                  allFilled={allFilled}
                  onVariableChange={(name, val) => setVariableData(p => ({ ...p, [name]: val }))}
                  onApply={handleApplyVariables}
                  onClear={() => setVariableData({})}
                />
              )}
              {activePanel === "clauses" && (
                <ClausesPanel
                  clauses={filteredClauses}
                  search={clauseSearch}
                  onSearchChange={setClauseSearch}
                  onInsert={handleInsertClause}
                />
              )}
              {activePanel === "signatures" && (
                <SignaturesPanel onInsert={(dataUrl, label) => {
                  if (!editor) return;
                  const html = `<figure style="margin:1.5em 0;display:inline-block;text-align:center">
                    <img src="${dataUrl}" alt="Signature" style="max-width:240px;height:auto;display:block" />
                    ${label ? `<figcaption style="margin-top:4px;font-size:11px;color:#6b7280;border-top:1px solid #d1d5db;padding-top:4px">${label}</figcaption>` : ""}
                  </figure>`;
                  editor.chain().focus().insertContent(html).run();
                }} />
              )}
              {activePanel === "properties" && (
                <PropertiesPanel
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
              {activePanel === "history" && (
                <HistoryPanel
                  versions={contract.versions}
                  onView={setViewingVersion}
                  onRestore={handleRestoreVersion}
                />
              )}
            </div>
          </div>
        </div>

        {/* ────────────── EDITOR + PREVIEW (split) ───────────────────────── */}
        <div className="flex flex-1 min-w-0 overflow-hidden" ref={splitContainerRef}>

          {/* ── EDITOR PANE ─────────────────────────────────────────────── */}
          <div
            className="flex flex-col min-h-0 overflow-hidden transition-all duration-200"
            style={{ flexBasis: showPreview ? `${splitPct}%` : "100%", flexShrink: 0, flexGrow: 0 }}
          >
            {/* Toolbar */}
            <div className="no-print shrink-0">
              <EditorToolbar
                editor={editor}
                onSave={handleSave}
                onSaveVersion={() => setShowVersionDialog(true)}
                onPrint={handleExport}
                onToggleSidebar={() => setActivePanel(p => p === "properties" ? null : "properties")}
                onMargins={() => { setTempMargins({ ...contract.pageMargins }); setShowMarginsDialog(true); }}
                sidebarOpen={activePanel === "properties"}
                isDirty={isDirty}
              />
            </div>

            {/* Editor canvas — responsive: centers the A4 canvas, allows horizontal scroll on small screens */}
            <div className="flex-1 overflow-auto bg-secondary relative">
              {!showPreview && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="fixed sm:absolute top-24 sm:top-6 right-6 z-10 flex items-center gap-2 px-3.5 py-2 bg-popover text-foreground hover:bg-secondary/80 hover:text-primary-foreground rounded-lg shadow-xl border border-border transition-all text-[13px] font-semibold"
                >
                  <PanelRightOpen className="w-4 h-4 text-primary" />
                  Show Preview
                </button>
              )}
              <div className="py-8 flex justify-center px-4 min-h-full min-w-[320px]">
                <div
                  className="bg-white shadow-xl w-full max-w-[816px] min-h-[1056px] page-canvas shrink-0"
                  style={pageStyle}
                >
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          </div>

          {/* ── DRAG SPLITTER (only when preview is visible) ─────────────── */}
          {showPreview && (
            <div
              className="w-[3px] shrink-0 cursor-col-resize select-none transition-colors duration-150 bg-accent hover:bg-primary/90/60 group flex items-center justify-center"
              onMouseDown={handleSplitterMouseDown}
              title="Drag to resize"
            >
              <div className="w-[3px] h-12 rounded-full bg-accent group-hover:bg-violet-400/80 transition-colors" />
            </div>
          )}

          {/* ── PREVIEW PANE (conditionally shown) ─────────────────────── */}
          {showPreview && <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-card">

            {/* Preview header */}
            <div className="no-print flex items-center gap-2 h-11 px-3 bg-card border-b border-border shrink-0">
              <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Preview</span>

              {hasVars && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border font-medium hidden sm:inline-flex",
                  allFilled
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                )}>
                  {filledCount}/{detectedVariables.length}
                </span>
              )}

              <div className="flex-1" />

              {/* Zoom controls */}
              <div className="flex items-center gap-0.5 bg-accent border border-border rounded-lg px-1.5 py-0.5">
                <button onClick={() => setZoom(z => Math.max(40, z - 10))} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded" title="Zoom out">
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[11px] text-muted-foreground w-9 text-center tabular-nums">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded" title="Zoom in">
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              {/* Collapse preview */}
              <button
                onClick={() => setShowPreview(false)}
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                title="Hide preview"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Preview scroll area */}
            <div className="flex-1 overflow-auto bg-muted">
              <div className="py-10 flex justify-center px-6 min-h-full">
                {previewHTML ? (
                  <div style={{ zoom: `${zoom}%`, flexShrink: 0 }}>
                    <div
                      className="bg-white shadow-2xl contract-editor-content"
                      style={{
                        width: 816,
                        minHeight: 1056,
                        paddingTop: contract.pageMargins.top,
                        paddingRight: contract.pageMargins.right,
                        paddingBottom: contract.pageMargins.bottom,
                        paddingLeft: contract.pageMargins.left,
                        color: "#111827",
                        fontSize: "12pt",
                        fontFamily: "'Times New Roman', Times, serif",
                        lineHeight: 1.6,
                      }}
                      dangerouslySetInnerHTML={{ __html: previewHTML }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">Nothing to preview yet</p>
                      <p className="text-muted-foreground text-xs mt-1">Start writing in the editor to see the live preview here.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>}
        </div>
      </div>

      {/* ═══════════════════════════ MODALS ═════════════════════════════════ */}

      {viewingVersion && (
        <VersionPreviewModal
          version={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRestore={(id) => { handleRestoreVersion(id); setViewingVersion(null); }}
        />
      )}
      {showVersionDialog && (
        <VersionDialog
          label={versionLabel}
          onLabelChange={setVersionLabel}
          onSave={handleSaveVersion}
          onCancel={() => { setShowVersionDialog(false); setVersionLabel(""); }}
        />
      )}
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

// ===========================================================================
// SIDE PANEL CONTENTS
// ===========================================================================

// ── Variables Panel ──────────────────────────────────────────────────────────

const VAR_ICON: Record<string, ReactNode> = {
  text: <span className="text-[10px] font-bold text-muted-foreground">Aa</span>,
  date: <CalendarDays className="w-3 h-3 text-muted-foreground" />,
  number: <Hash className="w-3 h-3 text-muted-foreground" />,
  currency: <DollarSign className="w-3 h-3 text-muted-foreground" />,
  dropdown: <ChevronDown className="w-3 h-3 text-muted-foreground" />,
  signature: <PenLine className="w-3 h-3 text-muted-foreground" />,
};

function VariablesPanel({ variables, variableData, filledCount, allFilled, onVariableChange, onApply, onClear }: {
  variables: TemplateVariable[];
  variableData: TemplateData;
  filledCount: number;
  allFilled: boolean;
  onVariableChange: (name: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  if (variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
          <Wand2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm font-medium">No variables detected</p>
          <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
            Use <code className="bg-accent px-1 rounded text-primary">{"{{variableName}}"}</code> syntax in your document
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">{filledCount} of {variables.length} filled</span>
          {filledCount > 0 && (
            <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors">
              Clear all
            </button>
          )}
        </div>
        <div className="h-1 rounded-full bg-accent overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", allFilled ? "bg-emerald-500" : "bg-violet-500")}
            style={{ width: `${variables.length ? (filledCount / variables.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {variables.map((v) => {
          const filled = variableData[v.name]?.trim().length > 0;
          const inputCls = "w-full px-3 py-2 text-xs bg-accent text-foreground border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground";
          return (
            <div key={v.name} className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                {VAR_ICON[v.type] ?? VAR_ICON.text}
                {v.label}
                {filled && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
              </label>
              {v.type === "date" ? (
                <input type="date" value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} className={inputCls} />
              ) : v.type === "number" ? (
                <input type="number" value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} placeholder={`Enter ${v.label.toLowerCase()}…`} className={inputCls} />
              ) : v.type === "currency" ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <input type="number" min="0" step="0.01" value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} placeholder="0.00" className={cn(inputCls, "pl-7")} />
                </div>
              ) : v.type === "dropdown" && v.options?.length ? (
                <select value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} className={cn(inputCls, "cursor-pointer")}>
                  <option value="">Select…</option>
                  {v.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : v.type === "signature" ? (
                <input type="text" value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} placeholder="Type full name as signature…" className={cn(inputCls, "italic")} />
              ) : (
                <input type="text" value={variableData[v.name] ?? ""} onChange={e => onVariableChange(v.name, e.target.value)} placeholder={`Enter ${v.label.toLowerCase()}…`} className={inputCls} />
              )}
            </div>
          );
        })}
      </div>

      {/* Apply button */}
      <div className="p-4 border-t border-border shrink-0">
        <button
          onClick={onApply}
          disabled={filledCount === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Apply Variables to Document
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          This permanently replaces tokens in the editor
        </p>
      </div>
    </div>
  );
}

// ── Clauses Panel ─────────────────────────────────────────────────────────────

function ClausesPanel({ clauses, search, onSearchChange, onInsert }: {
  clauses: Clause[];
  search: string;
  onSearchChange: (v: string) => void;
  onInsert: (c: Clause) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <input
          type="text" value={search} onChange={e => onSearchChange(e.target.value)}
          placeholder="Search clauses…"
          className="w-full px-3 py-2 text-xs bg-accent text-foreground border border-border rounded-lg focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {clauses.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 italic">No clauses match.</p>
        )}
        {clauses.map(c => (
          <div key={c.id} className="group border border-border hover:border-primary rounded-lg p-3 space-y-2 transition-colors bg-accent">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-foreground leading-tight">{c.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.description}</p>
              </div>
              <button
                onClick={() => onInsert(c)}
                className="shrink-0 px-2 py-1 text-[10px] font-semibold bg-primary/10 hover:bg-primary/90/30 text-primary border border-primary rounded-md transition-colors opacity-0 group-hover:opacity-100"
              >
                Insert
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed line-clamp-2 bg-accent rounded px-2 py-1.5">
              {c.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Signatures Panel ──────────────────────────────────────────────────────────

type SigTab = "draw" | "type" | "upload";

function SignaturesPanel({ onInsert }: {
  onInsert: (dataUrl: string, label: string) => void;
}) {
  const [tab, setTab] = useState<SigTab>("draw");
  const [signerName, setSignerName] = useState("");
  const [typeText, setTypeText] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const lastMid = useRef<{ x: number; y: number } | null>(null);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pt = getPoint(e);
    lastPt.current = pt;
    lastMid.current = pt;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
  };

  const continueDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current || !lastPt.current || !lastMid.current) return;
    e.preventDefault();
    const pt = getPoint(e);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const midPt = { x: (lastPt.current.x + pt.x) / 2, y: (lastPt.current.y + pt.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(lastMid.current.x, lastMid.current.y);
    ctx.quadraticCurveTo(lastPt.current.x, lastPt.current.y, midPt.x, midPt.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPt.current = pt;
    lastMid.current = midPt;
    setHasStrokes(true);
  };

  const stopDraw = () => { setIsDrawing(false); lastPt.current = null; lastMid.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const insertDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    onInsert(canvas.toDataURL("image/png"), signerName);
    clearCanvas();
    setSignerName("");
  };

  const insertTypedSignature = () => {
    if (!typeText.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 120;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 400, 120);
    ctx.font = "italic 52px 'Brush Script MT', 'Dancing Script', cursive";
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typeText, 200, 60);
    onInsert(canvas.toDataURL("image/png"), signerName);
    setTypeText("");
    setSignerName("");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) { onInsert(src, signerName); setSignerName(""); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const tabs: { id: SigTab; icon: ReactNode; label: string }[] = [
    { id: "draw", icon: <PenLine className="w-3.5 h-3.5" />, label: "Draw" },
    { id: "type", icon: <Type className="w-3.5 h-3.5" />, label: "Type" },
    { id: "upload", icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Upload" },
  ];

  const inputCls = "w-full px-3 py-2 text-xs bg-accent text-foreground border border-border rounded-lg focus:outline-none focus:border-primary placeholder:text-muted-foreground";

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-0.5 p-3 pb-0 shrink-0">
        {tabs.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
              tab === id
                ? "bg-primary/20 text-primary border border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Signer name (shared) */}
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1 font-semibold uppercase tracking-wider">Signer Name / Label</label>
          <input
            type="text"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            placeholder="e.g. John Smith, CEO"
            className={inputCls}
          />
        </div>

        {/* ── Draw tab ── */}
        {tab === "draw" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Draw your signature below</p>
              {hasStrokes && (
                <button onClick={clearCanvas} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />Clear
                </button>
              )}
            </div>
            <div className="rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors">
              <canvas
                ref={canvasRef}
                width={520}
                height={180}
                className="w-full bg-card cursor-crosshair block touch-none"
                style={{ height: 150 }}
                onMouseDown={startDraw}
                onMouseMove={continueDraw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={continueDraw}
                onTouchEnd={stopDraw}
              />
            </div>
            {!hasStrokes && (
              <p className="text-[10px] text-muted-foreground text-center italic">Sign in the box above</p>
            )}
            <button
              onClick={insertDrawnSignature}
              disabled={!hasStrokes}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PenLine className="w-3.5 h-3.5" />Insert Signature
            </button>
          </div>
        )}

        {/* ── Type tab ── */}
        {tab === "type" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Type your name and we'll render it in a signature style</p>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Signature Text</label>
              <input
                type="text"
                value={typeText}
                onChange={e => setTypeText(e.target.value)}
                placeholder="Your full name…"
                className={inputCls}
              />
            </div>
            {typeText && (
              <div className="rounded-xl border border-border bg-card flex items-center justify-center py-6 px-4">
                <span style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 42, color: "#1e293b", fontStyle: "italic" }}>
                  {typeText}
                </span>
              </div>
            )}
            <button
              onClick={insertTypedSignature}
              disabled={!typeText.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Type className="w-3.5 h-3.5" />Insert Typed Signature
            </button>
          </div>
        )}

        {/* ── Upload tab ── */}
        {tab === "upload" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Upload an image of your handwritten signature</p>
            <label className="flex flex-col items-center gap-3 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors bg-accent hover:bg-accent">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium">Click to upload</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG or SVG (transparent PNG recommended)</p>
              </div>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Properties Panel ──────────────────────────────────────────────────────────

function PropertiesPanel({ contract, tagInput, setTagInput, onTypeChange, onStatusChange, onAddTag, onRemoveTag, onAddParty, onUpdateParty, onPartyBlur, onRemoveParty }: {
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
}) {
  const inputCls = "w-full px-2.5 py-1.5 text-xs bg-accent text-foreground border border-border rounded-md focus:outline-none focus:border-primary placeholder:text-muted-foreground";

  return (
    <div className="overflow-y-auto h-full p-4 space-y-6">
      {/* Details */}
      <SideSection icon={<FileText className="w-3.5 h-3.5" />} title="Details">
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Contract Type</label>
            <select value={contract.type} onChange={e => onTypeChange(e.target.value as ContractType)} className={cn(inputCls, "cursor-pointer")}>
              {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Status</label>
            <select value={contract.status} onChange={e => onStatusChange(e.target.value as ContractStatus)} className={cn(inputCls, "cursor-pointer")}>
              {(["Draft", "Review", "Signed", "Archived"] as ContractStatus[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="pt-1 border-t border-border space-y-1">
            {[["Created", contract.createdAt], ["Updated", contract.updatedAt]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-muted-foreground">{formatDate(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </SideSection>

      {/* Tags */}
      <SideSection icon={<Tag className="w-3.5 h-3.5" />} title="Tags">
        <div className="space-y-2">
          {contract.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {contract.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary">
                  {tag}
                  <button onClick={() => onRemoveTag(tag)} className="hover:text-red-400 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddTag(tagInput); } }}
              placeholder="tag1, tag2…"
              className={cn(inputCls, "flex-1 min-w-0")}
            />
            <button onClick={() => onAddTag(tagInput)} className="px-2 rounded-md bg-accent hover:bg-accent border border-border text-muted-foreground transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </SideSection>

      {/* Parties */}
      <SideSection icon={<Users className="w-3.5 h-3.5" />} title="Parties">
        <div className="space-y-2">
          {contract.parties.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">No parties added yet.</p>
          )}
          {contract.parties.map(party => (
            <div key={party.id} className="relative group border border-border rounded-lg p-2.5 space-y-1.5 hover:border-border transition-colors">
              <button onClick={() => onRemoveParty(party.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                <X className="w-3 h-3" />
              </button>
              {(["name", "role", "email", "company"] as (keyof Party)[]).map(field => (
                <input
                  key={field} type={field === "email" ? "email" : "text"}
                  value={party[field]} onChange={e => onUpdateParty(party.id, field, e.target.value)}
                  onBlur={onPartyBlur}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  className="w-full px-2 py-1 text-[10px] bg-accent text-foreground border border-border rounded focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                />
              ))}
            </div>
          ))}
          <button
            onClick={onAddParty}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-border rounded-lg transition-all"
          >
            <Plus className="w-3 h-3" />Add Party
          </button>
        </div>
      </SideSection>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ versions, onView, onRestore }: {
  versions: ContractVersion[];
  onView: (v: ContractVersion) => void;
  onRestore: (id: string) => void;
}) {
  const sorted = [...versions].reverse();
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
          <History className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm font-medium">No versions yet</p>
          <p className="text-muted-foreground text-xs mt-1">Save a version to create a named snapshot you can restore later.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-y-auto h-full p-3 space-y-2">
      {sorted.map((v, idx) => (
        <div key={v.id} className="border border-border rounded-lg p-3 space-y-2.5 hover:border-border transition-colors bg-accent">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-[10px] font-bold shrink-0">
              v{v.number}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground truncate">{v.label}</p>
                {idx === 0 && <span className="text-[9px] px-1.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">latest</span>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(v.createdAt)}</p>
              <p className="text-[10px] text-muted-foreground">{v.wordCount.toLocaleString()} words</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onView(v)} className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-md transition-all">
              <Eye className="w-3 h-3" />View
            </button>
            <button onClick={() => onRestore(v.id)} className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-md transition-all">
              <RotateCcw className="w-3 h-3" />Restore
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper for side panels ──────────────────────────────────────────

function SideSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

// ===========================================================================
// MODALS (version preview, save version dialog, margins dialog)
// ===========================================================================

function VersionPreviewModal({ version, onClose, onRestore }: {
  version: ContractVersion;
  onClose: () => void;
  onRestore: (id: string) => void;
}) {
  const previewEditor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
      Underline, TextStyle, FontSize, Color, Highlight.configure({ multicolor: true }), FontFamily,
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Image.configure({ inline: false, allowBase64: true }), Link.configure({ openOnClick: false }),
      Subscript, Superscript, TaskList, TaskItem.configure({ nested: true }),
      Typography, Indent, SignatureBlock,
    ],
    content: (() => { try { return JSON.parse(version.content); } catch { return version.content; } })(),
    editable: false,
    immediatelyRender: false,
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="no-print shrink-0 flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold">
          v{version.number}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{version.label}</p>
          <p className="text-xs text-muted-foreground">{formatDate(version.createdAt)} · {version.wordCount.toLocaleString()} words</p>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-muted-foreground text-xs border border-border">
          <FileSearch className="w-3 h-3" />Read-only
        </span>
        <div className="flex-1" />
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg text-xs transition-all">
          <X className="w-3.5 h-3.5" />Close
        </button>
        <button onClick={() => onRestore(version.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-all">
          <RotateCcw className="w-3.5 h-3.5" />Restore this version
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-secondary py-10">
        <div className="bg-white shadow-2xl max-w-[816px] mx-auto" style={{ padding: 96 }}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />Save Version
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Create a named snapshot you can restore later.</p>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-1.5">Version Label</label>
          <input
            autoFocus type="text" value={label} onChange={e => onLabelChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            placeholder="e.g. Added payment terms"
            className="w-full px-3 py-2.5 text-sm bg-accent text-foreground border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg transition-all">Cancel</button>
          <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-all">
            <GitBranch className="w-3.5 h-3.5" />Save Version
          </button>
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
  const toIn = (px: number) => Math.round((px / 96) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Page Margins</h2>
          <p className="text-xs text-muted-foreground mt-1">Values in pixels. 96 px ≈ 1 inch.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="text-[10px] text-muted-foreground block mb-1">
                {label} <span className="opacity-60">({toIn(margins[key])} in)</span>
              </label>
              <input
                type="number" min={0} max={480} value={margins[key]}
                onChange={e => onChange({ ...margins, [key]: Math.max(0, Math.round(Number(e.target.value))) })}
                className="w-full px-2.5 py-2 text-sm bg-accent text-foreground border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg transition-all">Cancel</button>
          <button onClick={onApply} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-all">Apply Margins</button>
        </div>
      </div>
    </div>
  );
}
