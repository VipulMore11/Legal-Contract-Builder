// ---------------------------------------------------------------------------
// Core domain types for the contract management system
// ---------------------------------------------------------------------------

export type ContractStatus = 'Draft' | 'Review' | 'Signed' | 'Archived';

export type ContractType =
  | 'Service Agreement'
  | 'Non-Disclosure Agreement'
  | 'Employment Contract'
  | 'Freelance Agreement'
  | 'License Agreement'
  | 'Purchase Agreement'
  | 'Partnership Agreement'
  | 'Lease Agreement'
  | 'Consulting Agreement'
  | 'Other';

export const CONTRACT_TYPES: ContractType[] = [
  'Service Agreement',
  'Non-Disclosure Agreement',
  'Employment Contract',
  'Freelance Agreement',
  'License Agreement',
  'Purchase Agreement',
  'Partnership Agreement',
  'Lease Agreement',
  'Consulting Agreement',
  'Other',
];

export const STATUS_STYLES: Record<ContractStatus, string> = {
  Draft: 'bg-yellow-500/20 text-yellow-600 border border-yellow-500/30',
  Review: 'bg-blue-500/20   text-blue-600   border border-blue-500/30',
  Signed: 'bg-green-500/20  text-green-600  border border-green-500/30',
  Archived: 'bg-gray-500/20   text-gray-600   border border-gray-500/30',
};

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface Party {
  id: string;
  name: string;
  role: string;    // e.g. "Client", "Service Provider", "Employee"
  email: string;
  company: string;
}

export interface PageMargins {
  top: number;    // px (96 DPI — 96px ≈ 1 inch)
  right: number;
  bottom: number;
  left: number;
}

export interface ContractVersion {
  id: string;
  number: number;
  label: string;           // user-supplied name, e.g. "Added payment terms"
  content: string;         // Tiptap JSON serialised as string
  createdAt: string;       // ISO-8601
  wordCount: number;
  charCount: number;
}

// ---------------------------------------------------------------------------
// Root contract document
// ---------------------------------------------------------------------------

export interface Contract {
  id: string;
  title: string;
  content: string;         // Tiptap JSON serialised as string
  status: ContractStatus;
  type: ContractType;
  parties: Party[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pageMargins: PageMargins;
  versions: ContractVersion[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_MARGINS: PageMargins = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

/** Tiptap JSON for a blank contract skeleton */
export const BLANK_CONTRACT_CONTENT = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center', indent: null },
      content: [{ type: 'text', text: 'CONTRACT AGREEMENT' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center', indent: null },
      content: [
        {
          type: 'text',
          text: 'This Agreement is entered into as of [DATE], by and between:',
        },
      ],
    },
    { type: 'paragraph', attrs: { textAlign: 'left', indent: null }, content: [] },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', indent: null },
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: '[PARTY A NAME]' },
        { type: 'text', text: ', a company incorporated under the laws of [JURISDICTION] ("Party A");' },
      ],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center', indent: null },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'AND' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', indent: null },
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: '[PARTY B NAME]' },
        { type: 'text', text: ', a company incorporated under the laws of [JURISDICTION] ("Party B").' },
      ],
    },
    { type: 'paragraph', attrs: { textAlign: 'left', indent: null }, content: [] },
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'left', indent: null },
      content: [{ type: 'text', text: '1. Scope of Work' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', indent: null },
      content: [{ type: 'text', text: 'Describe the scope of work here...' }],
    },
    { type: 'paragraph', attrs: { textAlign: 'left', indent: null }, content: [] },
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'left', indent: null },
      content: [{ type: 'text', text: '2. Compensation' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', indent: null },
      content: [{ type: 'text', text: 'Describe compensation terms here...' }],
    },
    { type: 'paragraph', attrs: { textAlign: 'left', indent: null }, content: [] },
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'left', indent: null },
      content: [{ type: 'text', text: '3. Term' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left', indent: null },
      content: [{ type: 'text', text: 'This Agreement shall commence on [START DATE] and continue until [END DATE], unless earlier terminated.' }],
    },
    { type: 'paragraph', attrs: { textAlign: 'left', indent: null }, content: [] },
  ],
});
