/**
 * POST /api/ai
 *
 * Server-side proxy for Google Gemini API.
 * - Reads GEMINI_API_KEY from process.env (never exposed to client)
 * - In-memory rate limiting: 10 req/min + 100 req/hr per IP
 * - Actions: generate | edit | suggest
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-IP)
// ---------------------------------------------------------------------------

interface RateBucket {
  /** Timestamps of requests in the current minute window */
  minuteHits: number[];
  /** Timestamps of requests in the current hour window */
  hourHits: number[];
}

const limiter = new Map<string, RateBucket>();

const MAX_PER_MINUTE = 10;
const MAX_PER_HOUR = 100;

/** Clean stale entries every 10 minutes */
const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const hourAgo = now - 3_600_000;
  for (const [ip, bucket] of limiter) {
    bucket.hourHits = bucket.hourHits.filter((t) => t > hourAgo);
    bucket.minuteHits = bucket.minuteHits.filter((t) => t > now - 60_000);
    if (bucket.hourHits.length === 0 && bucket.minuteHits.length === 0) {
      limiter.delete(ip);
    }
  }
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  cleanup();
  const now = Date.now();
  let bucket = limiter.get(ip);
  if (!bucket) {
    bucket = { minuteHits: [], hourHits: [] };
    limiter.set(ip, bucket);
  }

  // Prune expired entries
  bucket.minuteHits = bucket.minuteHits.filter((t) => t > now - 60_000);
  bucket.hourHits = bucket.hourHits.filter((t) => t > now - 3_600_000);

  // Check minute limit
  if (bucket.minuteHits.length >= MAX_PER_MINUTE) {
    const oldest = bucket.minuteHits[0];
    const retryAfter = Math.ceil((oldest + 60_000 - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Check hour limit
  if (bucket.hourHits.length >= MAX_PER_HOUR) {
    const oldest = bucket.hourHits[0];
    const retryAfter = Math.ceil((oldest + 3_600_000 - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Record the request
  bucket.minuteHits.push(now);
  bucket.hourHits.push(now);
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_GENERATE = `You are an expert legal contract drafting assistant. Generate professional, legally-sound contracts based on user descriptions.

Rules:
- Use proper legal language and formal tone
- Structure with numbered sections and clear headings
- Use HTML formatting: <h1> for title, <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul>/<li> for lists, <strong> for bold, etc.
- Include standard legal provisions (definitions, governing law, severability, entire agreement, etc.)
- Use {{variableName}} placeholders for details that should be filled in later (e.g., {{effectiveDate}}, {{partyAName}}, {{partyAAddress}})
- Be comprehensive but concise
- Do NOT include any explanatory text before or after the contract — output ONLY the HTML contract itself, without markdown code blocks.`;

const SYSTEM_EDIT = `You are an expert legal contract editing assistant. You modify existing contract HTML based on user instructions.

Rules:
- Return ONLY the complete modified contract HTML — no explanations, no commentary, no markdown code blocks
- Preserve the original HTML structure and formatting unless asked to change it
- Maintain consistent legal tone and terminology
- Use {{variableName}} placeholders where appropriate
- If the user asks to add a section, integrate it naturally into the existing HTML structure
- If the user asks to modify specific text, change only that part and leave the rest intact`;

const SYSTEM_SUGGEST = `You are a legal clause suggestion assistant. Given the context of an existing contract (in HTML), suggest relevant clauses the user might want to add.

Rules:
- Return 3-5 clause suggestions
- Format each as HTML: <h3>Clause Title</h3><p>Clause text here...</p><hr>
- Use formal legal language
- Make clauses relevant to the contract context provided
- Use {{variableName}} placeholders for fillable details
- Do NOT include explanatory commentary — just the HTML clauses without markdown code blocks`;

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service is not configured. GEMINI_API_KEY is missing from server environment." },
      { status: 503 }
    );
  }

  // 2. Rate limit
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // 3. Parse body
  let body: { action?: string; prompt?: string; context?: string; contractType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, prompt, context, contractType } = body;
  if (!action || !prompt) {
    return NextResponse.json(
      { error: "Missing required fields: action, prompt" },
      { status: 400 }
    );
  }

  // 4. Build the prompt based on action
  let systemPrompt: string;
  let userPrompt: string;

  switch (action) {
    case "generate":
      systemPrompt = SYSTEM_GENERATE;
      userPrompt = contractType
        ? `Generate a ${contractType} based on this description:\n\n${prompt}`
        : `Generate a legal contract based on this description:\n\n${prompt}`;
      break;

    case "edit":
      systemPrompt = SYSTEM_EDIT;
      userPrompt = context
        ? `Here is the current contract:\n\n---\n${context}\n---\n\nUser instruction: ${prompt}`
        : `User instruction: ${prompt}`;
      break;

    case "suggest":
      systemPrompt = SYSTEM_SUGGEST;
      userPrompt = context
        ? `Here is the current contract context:\n\n---\n${context}\n---\n\nSuggest relevant clauses for this contract.${prompt ? ` Focus on: ${prompt}` : ""}`
        : `Suggest relevant legal clauses. ${prompt}`;
      break;

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Use "generate", "edit", or "suggest".` },
        { status: 400 }
      );
  }

  // 5. Call Gemini
  try {
    const content = await callGemini(systemPrompt, userPrompt, apiKey);
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    console.error("[AI Route]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
