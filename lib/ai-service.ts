/**
 * Client-side AI service — thin wrapper around POST /api/ai.
 * No API key handling needed; the server manages it.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResponse {
  content: string;
  error?: string;
  retryAfter?: number;
}

export type AIAction = "generate" | "edit" | "suggest";

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

async function callAI(body: {
  action: AIAction;
  prompt: string;
  context?: string;
  contractType?: string;
}): Promise<AIResponse> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.status === 429) {
      return {
        content: "",
        error: data.error || "Rate limit exceeded. Please wait a moment.",
        retryAfter: data.retryAfter ?? 30,
      };
    }

    if (!res.ok) {
      return {
        content: "",
        error: data.error || `Request failed (${res.status})`,
      };
    }

    return { content: data.content };
  } catch (err) {
    return {
      content: "",
      error: err instanceof Error ? err.message : "Network error — check your connection.",
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a full contract from a natural language description.
 */
export function generateContract(
  prompt: string,
  contractType?: string
): Promise<AIResponse> {
  return callAI({ action: "generate", prompt, contractType });
}

/**
 * Edit/modify an existing contract based on an instruction.
 * `existingContent` = the current plain-text of the contract.
 */
export function editContractWithAI(
  existingContent: string,
  instruction: string
): Promise<AIResponse> {
  return callAI({
    action: "edit",
    prompt: instruction,
    context: existingContent,
  });
}

/**
 * Suggest relevant clauses for the current contract.
 */
export function suggestClauses(
  context: string,
  focusArea?: string
): Promise<AIResponse> {
  return callAI({
    action: "suggest",
    prompt: focusArea || "",
    context,
  });
}
