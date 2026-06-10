// ---------------------------------------------------------------------------
// Template system types
// ---------------------------------------------------------------------------

export type VariableType =
  | "text"
  | "date"
  | "number"
  | "currency"
  | "dropdown"
  | "signature";

export interface TemplateVariable {
  /** Matches the {{varName}} token in the template body */
  name: string;
  /** Human-friendly label shown in the fill-in form */
  label: string;
  type: VariableType;
  /** Date format string (e.g. "D MMMM YYYY"). Only used when type === 'date' */
  format?: string;
  /** Selectable options. Only used when type === 'dropdown' */
  options?: string[];
  /** Optional placeholder shown inside form inputs */
  placeholder?: string;
}

/**
 * A contract template.
 * The body contains plain text with {{variableName}} tokens that are replaced
 * at render time.
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Plain-text (markdown-ish) body with {{variableName}} / {{varName as "FORMAT"}} tokens */
  body: string;
  /** Auto-detected and optionally customised variable definitions */
  variables: TemplateVariable[];
  createdAt: string;
  updatedAt: string;
  /** Whether this is one of the built-in (bundled) templates */
  builtIn?: boolean;
}

/**
 * The user-supplied data keyed by variable name.
 * All values are stored as strings; the template engine formats them at
 * render time (e.g. date formatting, currency prefix, etc.).
 */
export type TemplateData = Record<string, string>;
