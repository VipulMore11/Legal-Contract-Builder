/**
 * Pure utility functions for the template system.
 * No React / Next.js dependencies — safe to use anywhere.
 */

import type { TemplateVariable, VariableType, TemplateData } from "@/types/template";

// ---------------------------------------------------------------------------
// Token regex
// ---------------------------------------------------------------------------

/**
 * Matches tokens like:
 *   {{effectiveDate}}
 *   {{effectiveDate as "D MMMM YYYY"}}
 *
 * Capture groups:
 *   [1] variable name
 *   [2] format string (optional, without quotes)
 */
export const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:as\s+"([^"]+)")?\s*\}\}/g;

// ---------------------------------------------------------------------------
// extractVariableNames
// ---------------------------------------------------------------------------

export function extractVariableNames(body: string): Array<{ name: string; format?: string }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; format?: string }> = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  for (const match of body.matchAll(re)) {
    const name = match[1];
    const format = match[2] ?? undefined;
    if (!seen.has(name)) {
      seen.add(name);
      result.push({ name, format });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// inferVariableType
// ---------------------------------------------------------------------------

const DATE_HINTS = ["date", "day", "month", "year", "start", "end", "expir", "effective", "signed", "birth", "deadline"];
const CURRENCY_HINTS = ["amount", "fee", "salary", "cost", "price", "pay", "wage", "rate", "total", "budget", "compensation"];
const NUMBER_HINTS = ["count", "number", "qty", "quantity", "num", "days", "months", "years", "hours", "percent"];

function matchesHint(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((h) => lower.includes(h));
}

export function inferVariableType(name: string, format?: string): VariableType {
  if (format) return "date";
  if (matchesHint(name, DATE_HINTS)) return "date";
  if (matchesHint(name, CURRENCY_HINTS)) return "currency";
  if (matchesHint(name, NUMBER_HINTS)) return "number";
  return "text";
}

// ---------------------------------------------------------------------------
// humanizeLabel
// ---------------------------------------------------------------------------

export function humanizeLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// buildVariables
// ---------------------------------------------------------------------------

export function buildVariables(
  body: string,
  existing: TemplateVariable[] = []
): TemplateVariable[] {
  const found = extractVariableNames(body);
  const existingMap = new Map(existing.map((v) => [v.name, v]));
  return found.map(({ name, format }) => {
    const prev = existingMap.get(name);
    if (prev) return prev;
    return {
      name,
      label: humanizeLabel(name),
      type: inferVariableType(name, format),
      format,
      placeholder: "",
      options: [],
    };
  });
}

// ---------------------------------------------------------------------------
// formatValue
// ---------------------------------------------------------------------------

export function formatValue(raw: string, variable: TemplateVariable): string {
  if (!raw) return "";

  if (variable.type === "date" && raw) {
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      const fmt = variable.format ?? "";
      if (fmt) {
        const day = d.getDate();
        const month = d.toLocaleString("en-GB", { month: "long" });
        const monthShort = d.toLocaleString("en-GB", { month: "short" });
        const year = d.getFullYear();
        const month2 = String(d.getMonth() + 1).padStart(2, "0");
        const day2 = String(day).padStart(2, "0");
        return fmt
          .replace("MMMM", month)
          .replace("MMM", monthShort)
          .replace("MM", month2)
          .replace("YYYY", String(year))
          .replace("YY", String(year).slice(-2))
          .replace("DD", day2)
          .replace("D", String(day));
      }
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return raw;
    }
  }

  if (variable.type === "currency") {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
    }
  }

  return raw;
}

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------

export function renderTemplate(
  body: string,
  data: TemplateData,
  variables: TemplateVariable[]
): string {
  const varMap = new Map(variables.map((v) => [v.name, v]));
  const re = new RegExp(TOKEN_RE.source, "g");
  return body.replace(re, (_match, name: string) => {
    const value = data[name];
    if (!value) return `{{${name}}}`;
    const variable = varMap.get(name);
    return variable ? formatValue(value, variable) : value;
  });
}

// ---------------------------------------------------------------------------
// applyVariablesToTiptapJSON
// ---------------------------------------------------------------------------

/**
 * Deep-traverse a Tiptap document JSON and replace all {{varName}} tokens
 * in text nodes with their formatted values from `data`.
 * Tokens with no matching data key are left unchanged.
 */
export function applyVariablesToTiptapJSON(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  data: TemplateData,
  variables: TemplateVariable[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const varMap = new Map(variables.map((v) => [v.name, v]));
  const re = new RegExp(TOKEN_RE.source, "g");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processNode(node: any): any {
    if (node.type === "text" && typeof node.text === "string") {
      const newText = node.text.replace(re, (_match: string, name: string) => {
        const value = data[name];
        if (!value) return _match;
        const variable = varMap.get(name);
        return variable ? formatValue(value, variable) : value;
      });
      return { ...node, text: newText };
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: node.content.map(processNode) };
    }
    return node;
  }

  return processNode(json);
}

// ---------------------------------------------------------------------------
// templateBodyToTiptapJSON
// ---------------------------------------------------------------------------

export function templateBodyToTiptapJSON(text: string): object {
  const lines = text.split("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: any[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h1 = line.match(/^#\s+(.+)$/);

    if (h3) {
      nodes.push({ type: "heading", attrs: { level: 3, textAlign: "left", indent: null }, content: [{ type: "text", text: h3[1] }] });
    } else if (h2) {
      nodes.push({ type: "heading", attrs: { level: 2, textAlign: "left", indent: null }, content: [{ type: "text", text: h2[1] }] });
    } else if (h1) {
      nodes.push({ type: "heading", attrs: { level: 1, textAlign: "center", indent: null }, content: [{ type: "text", text: h1[1] }] });
    } else if (line === "") {
      nodes.push({ type: "paragraph", attrs: { textAlign: "left", indent: null }, content: [] });
    } else {
      nodes.push({ type: "paragraph", attrs: { textAlign: "left", indent: null }, content: [{ type: "text", text: line }] });
    }
  }

  if (nodes.length === 0) {
    nodes.push({ type: "paragraph", attrs: { textAlign: "left", indent: null }, content: [] });
  }

  return { type: "doc", content: nodes };
}
