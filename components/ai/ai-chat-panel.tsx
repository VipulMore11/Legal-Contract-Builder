"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Copy,
  FileInput,
  Replace,
  AlertCircle,
  Clock,
  Loader2,
  Trash2,
  Zap,
  PenLine,
  ListPlus,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateContract,
  editContractWithAI,
  suggestClauses,
} from "@/lib/ai-service";
import type { AIResponse } from "@/lib/ai-service";
import { templateBodyToTiptapJSON } from "@/lib/template-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  action?: string;
  isError?: boolean;
  retryAfter?: number;
}

interface AIChatPanelProps {
  /** The tiptap editor instance — used to insert/replace content */
  editor: ReturnType<typeof import("@tiptap/react").useEditor>;
  /** Plain text of the current document (for context) */
  documentText: string;
}

// ---------------------------------------------------------------------------
// Quick action chips
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  {
    id: "generate",
    label: "Generate Contract",
    icon: FileText,
    prompt: "",
    placeholder: "Describe the contract you need…",
    description: "Create a full contract from scratch",
  },
  {
    id: "add-clause",
    label: "Add Clause",
    icon: ListPlus,
    prompt: "",
    placeholder: "What clause should be added?",
    description: "Insert a new clause into your contract",
  },
  {
    id: "improve",
    label: "Improve Writing",
    icon: PenLine,
    prompt: "Improve the writing quality, make it more professional and legally precise while maintaining the same meaning.",
    placeholder: "",
    description: "Enhance clarity and legal tone",
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: Zap,
    prompt: "Provide a brief, bullet-point summary of the key terms and obligations in this contract.",
    placeholder: "",
    description: "Get a quick overview of key terms",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIChatPanel({ editor, documentText }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  // ── Add a message ─────────────────────────────────────────────────────────
  const addMessage = useCallback(
    (role: "user" | "ai", content: string, extra?: Partial<ChatMessage>) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: new Date(),
          ...extra,
        },
      ]);
    },
    []
  );

  // ── Handle AI response ────────────────────────────────────────────────────
  const handleAIResponse = useCallback(
    (res: AIResponse, action?: string) => {
      if (res.error) {
        addMessage("ai", res.error, { isError: true, retryAfter: res.retryAfter });
        if (res.retryAfter) setRateLimitCountdown(res.retryAfter);
      } else {
        addMessage("ai", res.content, { action });
      }
    },
    [addMessage]
  );

  // ── Send a prompt ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setActiveAction(null);

    // Determine what kind of request this is
    const action = activeAction;
    addMessage("user", text, { action: action ?? undefined });
    setIsLoading(true);

    let res: AIResponse;
    const htmlContext = editor?.getHTML() ?? documentText;

    try {
      if (action === "generate") {
        res = await generateContract(text);
      } else if (action === "add-clause") {
        res = await editContractWithAI(
          htmlContext,
          `Add the following clause to the contract: ${text}`
        );
      } else {
        // Default: treat as an edit instruction with context
        res = await editContractWithAI(htmlContext, text);
      }
      handleAIResponse(res, action ?? "edit");
    } catch {
      addMessage("ai", "Something went wrong. Please try again.", { isError: true });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeAction, documentText, editor, addMessage, handleAIResponse]);

  // ── Quick action handlers ─────────────────────────────────────────────────
  const handleQuickAction = useCallback(
    async (actionId: string) => {
      const action = QUICK_ACTIONS.find((a) => a.id === actionId);
      if (!action || isLoading) return;

      // Actions with a preset prompt (improve, summarize) fire immediately
      if (action.prompt) {
        addMessage("user", action.label, { action: actionId });
        setIsLoading(true);

        let res: AIResponse;
        const htmlContext = editor?.getHTML() ?? documentText;

        try {
          if (actionId === "summarize") {
            res = await editContractWithAI(htmlContext, action.prompt);
          } else {
            res = await editContractWithAI(htmlContext, action.prompt);
          }
          handleAIResponse(res, actionId);
        } catch {
          addMessage("ai", "Something went wrong. Please try again.", { isError: true });
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Actions that need user input — activate input mode
      setActiveAction(actionId);
      setInput("");
      inputRef.current?.focus();
    },
    [isLoading, documentText, editor, addMessage, handleAIResponse]
  );

  // ── Clean Markdown wrapping ───────────────────────────────────────────────
  const stripMarkdown = (content: string) => {
    let clean = content.trim();
    if (clean.startsWith("```html")) {
      clean = clean.replace(/^```html\n?/, "").replace(/\n?```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
    }
    return clean;
  };

  // ── Insert content at cursor ──────────────────────────────────────────────
  const handleInsertAtCursor = useCallback(
    (content: string) => {
      if (!editor) return;
      const cleanHtml = stripMarkdown(content);
      editor.chain().focus().insertContent(cleanHtml).run();
    },
    [editor]
  );

  // ── Replace entire document ───────────────────────────────────────────────
  const handleReplaceDocument = useCallback(
    (content: string) => {
      if (!editor) return;
      const cleanHtml = stripMarkdown(content);
      editor.commands.setContent(cleanHtml);
    },
    [editor]
  );

  // ── Copy to clipboard ────────────────────────────────────────────────────
  const handleCopy = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setActiveAction(null);
  }, []);

  // ── Active action placeholder ─────────────────────────────────────────────
  const activePlaceholder = activeAction
    ? QUICK_ACTIONS.find((a) => a.id === activeAction)?.placeholder ?? "Type your message…"
    : "Ask AI to edit, generate, or improve your contract…";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg ai-glow flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-foreground">AI Assistant</span>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Rate limit warning */}
        {rateLimitCountdown > 0 && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Rate limited — try again in <strong>{rateLimitCountdown}s</strong></span>
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      {messages.length === 0 && (
        <div className="px-4 py-4 border-b border-border shrink-0 space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.id)}
                  disabled={isLoading}
                  className={cn(
                    "ai-chip flex flex-col items-start gap-1.5 p-2.5 rounded-lg border text-left transition-all group",
                    "bg-accent/50 border-border hover:border-primary/50 hover:bg-primary/5",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-primary group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{action.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-snug">{action.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
              Use AI to generate, edit, or improve your contracts with natural language
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[95%] animate-in fade-in slide-in-from-bottom-2 duration-200",
              msg.role === "user"
                ? "ai-message-user ml-auto bg-primary text-primary-foreground"
                : msg.isError
                  ? "ai-message-ai bg-destructive/10 border border-destructive/20 text-destructive"
                  : "ai-message-ai bg-accent text-foreground border border-border"
            )}
          >
            {/* User message */}
            {msg.role === "user" && (
              <div>
                {msg.action && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-75 block mb-1">
                    {QUICK_ACTIONS.find((a) => a.id === msg.action)?.label ?? msg.action}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}

            {/* AI message */}
            {msg.role === "ai" && (
              <div>
                {msg.isError ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap ai-content max-h-[300px] overflow-y-auto mb-2 text-[11px] leading-relaxed">
                      {msg.content.length > 500 && !expandedMessages.has(msg.id) ? msg.content.slice(0, 500) + "…" : msg.content}
                      {msg.content.length > 500 && !expandedMessages.has(msg.id) && (
                        <button
                          onClick={() => setExpandedMessages((prev) => new Set(prev).add(msg.id))}
                          className="text-primary text-[10px] hover:underline ml-1"
                        >
                          Show full
                        </button>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                      <button
                        onClick={() => handleInsertAtCursor(msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Insert at cursor position"
                      >
                        <FileInput className="w-3 h-3" />
                        Insert
                      </button>
                      <button
                        onClick={() => handleReplaceDocument(msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Replace entire document"
                      >
                        <Replace className="w-3 h-3" />
                        Replace
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Copy to clipboard"
                      >
                        {copiedId === msg.id ? (
                          <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                        ) : (
                          <><Copy className="w-3 h-3" />Copy</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="ai-message-ai bg-accent border border-border rounded-xl px-4 py-3 max-w-[85%]">
            <div className="ai-typing-indicator flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-1">AI is thinking</span>
              <span className="ai-dot" />
              <span className="ai-dot" />
              <span className="ai-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        {/* Active action indicator */}
        {activeAction && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[10px] text-primary font-medium flex-1">
              {QUICK_ACTIONS.find((a) => a.id === activeAction)?.label}
            </span>
            <button
              onClick={() => setActiveAction(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-accent border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={activePlaceholder}
            rows={1}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-24 min-h-[20px]"
            style={{
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 96) + "px";
            }}
            disabled={isLoading || rateLimitCountdown > 0}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || rateLimitCountdown > 0}
            className={cn(
              "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all",
              input.trim() && !isLoading
                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-accent text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-1.5 opacity-60">
          Shift+Enter for new line · AI may produce inaccurate content
        </p>
      </div>
    </div>
  );
}
