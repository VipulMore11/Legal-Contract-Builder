'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListTodo,
  IndentIcon, Outdent,
  Link2, Table2, Image, Minus, PenLine,
  Undo2, Redo2,
  ChevronDown,
  Highlighter,
  PanelRight,
  Printer,
  Settings2,
} from 'lucide-react';
import { useRef } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '48', '72'];

const HEADING_LEVELS = [
  { label: 'Normal text',  value: 'normal' },
  { label: 'Heading 1',   value: 'h1' },
  { label: 'Heading 2',   value: 'h2' },
  { label: 'Heading 3',   value: 'h3' },
  { label: 'Heading 4',   value: 'h4' },
  { label: 'Block Quote', value: 'blockquote' },
  { label: 'Code Block',  value: 'codeBlock' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Sep() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />;
}

function TBtn({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
  className = '',
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors shrink-0
        ${active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main toolbar
// ---------------------------------------------------------------------------

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void;
  onSaveVersion: () => void;
  onPrint: () => void;
  onToggleSidebar: () => void;
  onMargins: () => void;
  sidebarOpen: boolean;
  isDirty: boolean;
}

export default function EditorToolbar({
  editor,
  onSave,
  onSaveVersion,
  onPrint,
  onToggleSidebar,
  onMargins,
  sidebarOpen,
  isDirty,
}: EditorToolbarProps) {
  const colorRef      = useRef<HTMLInputElement>(null);
  const highlightRef  = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  // ── Heading / style ──────────────────────────────────────────────────────
  const currentHeading = () => {
    for (let l = 1; l <= 4; l++) {
      if (editor.isActive('heading', { level: l })) return `h${l}`;
    }
    if (editor.isActive('blockquote')) return 'blockquote';
    if (editor.isActive('codeBlock')) return 'codeBlock';
    return 'normal';
  };

  const setStyle = (v: string) => {
    const c = editor.chain().focus();
    switch (v) {
      case 'h1': c.setHeading({ level: 1 }).run(); break;
      case 'h2': c.setHeading({ level: 2 }).run(); break;
      case 'h3': c.setHeading({ level: 3 }).run(); break;
      case 'h4': c.setHeading({ level: 4 }).run(); break;
      case 'blockquote': c.setBlockquote().run(); break;
      case 'codeBlock':  c.setCodeBlock().run();  break;
      default:           c.setParagraph().run();  break;
    }
  };

  // ── Font family ──────────────────────────────────────────────────────────
  const currentFont = () => {
    const attrs = editor.getAttributes('textStyle');
    return (attrs.fontFamily as string | undefined) ?? '';
  };

  // ── Font size ────────────────────────────────────────────────────────────
  const currentSize = () => {
    const attrs = editor.getAttributes('textStyle');
    return ((attrs as Record<string, unknown>).fontSize as string | undefined) ?? '12';
  };

  // ── Color / highlight ─────────────────────────────────────────────────────
  const applyColor = (hex: string) => {
    editor.chain().focus().setColor(hex).run();
  };
  const applyHighlight = (hex: string) => {
    editor.chain().focus().setHighlight({ color: hex }).run();
  };

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Insert table ─────────────────────────────────────────────────────────
  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // ── Insert link ──────────────────────────────────────────────────────────
  const insertLink = () => {
    const url = window.prompt('Enter URL:', editor.getAttributes('link').href ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
    }
  };

  const h = currentHeading();
  const headingLabel = HEADING_LEVELS.find((x) => x.value === h)?.label ?? 'Normal text';

  return (
    <div className="no-print bg-card border-b border-border shrink-0 select-none">
      {/* ── Row 1 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto">

        {/* Undo / Redo */}
        <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}>
          <Undo2 className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)"
          disabled={!editor.can().redo()}>
          <Redo2 className="w-3.5 h-3.5" />
        </TBtn>

        <Sep />

        {/* Heading / Style */}
        <div className="relative shrink-0">
          <select
            value={h}
            onChange={(e) => setStyle(e.target.value)}
            title="Paragraph style"
            className="appearance-none bg-transparent text-foreground text-xs pr-5 pl-2 py-1 rounded hover:bg-secondary/80 cursor-pointer focus:outline-none border-0 max-w-[130px] truncate"
          >
            {HEADING_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <Sep />

        {/* Font family */}
        <div className="relative shrink-0">
          <select
            value={currentFont()}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') editor.chain().focus().unsetFontFamily().run();
              else editor.chain().focus().setFontFamily(v).run();
            }}
            title="Font family"
            className="appearance-none bg-transparent text-foreground text-xs pr-5 pl-2 py-1 rounded hover:bg-secondary/80 cursor-pointer focus:outline-none border-0 max-w-[120px] truncate"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Font size */}
        <div className="relative shrink-0 ml-0.5">
          <select
            value={currentSize()}
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
            title="Font size"
            className="appearance-none bg-transparent text-foreground text-xs pr-5 pl-2 py-1 rounded hover:bg-secondary/80 cursor-pointer focus:outline-none border-0 w-14"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <Sep />

        {/* Bold / Italic / Underline / Strike */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <Underline className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </TBtn>

        <Sep />

        {/* Subscript / Superscript */}
        <TBtn onClick={() => editor.chain().focus().toggleSubscript().run()}
          active={editor.isActive('subscript')} title="Subscript">
          <Subscript className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleSuperscript().run()}
          active={editor.isActive('superscript')} title="Superscript">
          <Superscript className="w-3.5 h-3.5" />
        </TBtn>

        <Sep />

        {/* Text colour */}
        <button
          type="button"
          title="Text color"
          onClick={() => colorRef.current?.click()}
          className="relative inline-flex flex-col items-center justify-center w-7 h-7 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <span className="font-bold text-sm leading-none" style={{ color: editor.getAttributes('textStyle').color ?? '#e8eaed' }}>A</span>
          <span className="w-4 h-1 rounded-full mt-0.5" style={{ background: editor.getAttributes('textStyle').color ?? '#3b82f6' }} />
          <input ref={colorRef} type="color"
            defaultValue="#111827"
            onChange={(e) => applyColor(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </button>

        {/* Highlight */}
        <button
          type="button"
          title="Highlight color"
          onClick={() => highlightRef.current?.click()}
          className="relative inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Highlighter className="w-3.5 h-3.5" />
          <input ref={highlightRef} type="color"
            defaultValue="#fef08a"
            onChange={(e) => applyHighlight(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </button>

        {/* Spacer + right-side actions */}
        <div className="flex-1" />

        <Sep />

        {/* Page margins */}
        <TBtn onClick={onMargins} title="Page margins">
          <Settings2 className="w-3.5 h-3.5" />
        </TBtn>

        {/* Print */}
        <TBtn onClick={onPrint} title="Print / Export">
          <Printer className="w-3.5 h-3.5" />
        </TBtn>

        {/* Toggle sidebar */}
        <TBtn onClick={onToggleSidebar} active={sidebarOpen} title="Toggle sidebar panel">
          <PanelRight className="w-3.5 h-3.5" />
        </TBtn>
      </div>

      {/* ── Row 2 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto border-t border-border/50">

        {/* Alignment */}
        {(
          [
            { icon: AlignLeft,    align: 'left',    title: 'Align left' },
            { icon: AlignCenter,  align: 'center',  title: 'Align center' },
            { icon: AlignRight,   align: 'right',   title: 'Align right' },
            { icon: AlignJustify, align: 'justify', title: 'Justify' },
          ] as const
        ).map(({ icon: Icon, align, title }) => (
          <TBtn key={align}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}
            active={editor.isActive({ textAlign: align })}
            title={title}
          >
            <Icon className="w-3.5 h-3.5" />
          </TBtn>
        ))}

        <Sep />

        {/* Lists */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')} title="Checklist">
          <ListTodo className="w-3.5 h-3.5" />
        </TBtn>

        <Sep />

        {/* Indent / outdent */}
        <TBtn onClick={() => editor.chain().focus().outdent().run()} title="Decrease indent (Shift+Tab)">
          <Outdent className="w-3.5 h-3.5" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().indent().run()} title="Increase indent (Tab)">
          <IndentIcon className="w-3.5 h-3.5" />
        </TBtn>

        <Sep />

        {/* Insert: Link */}
        <TBtn onClick={insertLink} active={editor.isActive('link')} title="Insert / edit link">
          <Link2 className="w-3.5 h-3.5" />
        </TBtn>

        {/* Insert: Table */}
        <TBtn onClick={insertTable} title="Insert table">
          <Table2 className="w-3.5 h-3.5" />
        </TBtn>

        {/* Insert: Image */}
        <button
          type="button"
          title="Insert image"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center justify-center w-7 h-7 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 cursor-pointer"
        >
          <Image className="w-3.5 h-3.5" />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </button>

        {/* Insert: Horizontal rule */}
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Insert horizontal rule">
          <Minus className="w-3.5 h-3.5" />
        </TBtn>

        {/* Insert: Signature block */}
        <TBtn onClick={() => editor.chain().focus().insertSignatureBlock().run()} title="Insert signature block">
          <PenLine className="w-3.5 h-3.5" />
        </TBtn>

        {/* Table controls (shown only when inside a table) */}
        {editor.isActive('table') && (
          <>
            <Sep />
            {[
              { label: 'Add col →', fn: () => editor.chain().focus().addColumnAfter().run() },
              { label: 'Add row ↓', fn: () => editor.chain().focus().addRowAfter().run() },
              { label: 'Del col',   fn: () => editor.chain().focus().deleteColumn().run() },
              { label: 'Del row',   fn: () => editor.chain().focus().deleteRow().run() },
              { label: 'Del table', fn: () => editor.chain().focus().deleteTable().run() },
            ].map(({ label, fn }) => (
              <button
                key={label}
                type="button"
                onClick={fn}
                className="px-1.5 py-0.5 text-xs rounded bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {label}
              </button>
            ))}
          </>
        )}

        {/* Word / char count — right aligned */}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          {editor.storage.characterCount?.words() ?? 0} words
          &nbsp;·&nbsp;
          {editor.storage.characterCount?.characters() ?? 0} chars
        </span>
      </div>
    </div>
  );
}
