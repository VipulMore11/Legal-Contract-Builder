/**
 * storage.ts
 * localStorage persistence for the contract management system.
 */

import type { Contract, ContractVersion, PageMargins } from "@/types/contract";
import { DEFAULT_MARGINS, BLANK_CONTRACT_CONTENT } from "@/types/contract";
import type { Template, TemplateVariable } from "@/types/template";
import { buildVariables } from "@/lib/template-engine";

const KEY = "lawsky_contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAll(): Contract[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Contract[]) : [];
  } catch {
    return [];
  }
}

function writeAll(contracts: Contract[]): void {
  localStorage.setItem(KEY, JSON.stringify(contracts));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getAllContracts(): Contract[] {
  return readAll();
}

export function getContract(id: string): Contract | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function saveContract(contract: Contract): void {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === contract.id);
  const updated = { ...contract, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  writeAll(all);
}

export function deleteContract(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function duplicateContract(id: string): Contract | null {
  const original = getContract(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const dup: Contract = {
    ...original,
    id: crypto.randomUUID(),
    title: `${original.title} (Copy)`,
    status: "Draft",
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  saveContract(dup);
  return dup;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createNewContract(title = "Untitled Contract"): Contract {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    content: BLANK_CONTRACT_CONTENT,
    status: "Draft",
    type: "Other",
    parties: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    pageMargins: { ...DEFAULT_MARGINS },
    versions: [],
  };
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

export function saveVersion(
  contractId: string,
  label: string,
  content: string,
  wordCount: number,
  charCount: number,
): ContractVersion | null {
  const contract = getContract(contractId);
  if (!contract) return null;

  const version: ContractVersion = {
    id: crypto.randomUUID(),
    number: contract.versions.length + 1,
    label: label.trim() || `Version ${contract.versions.length + 1}`,
    content,
    createdAt: new Date().toISOString(),
    wordCount,
    charCount,
  };

  const updated: Contract = {
    ...contract,
    content, // keep the contract body in sync with the snapshot
    versions: [...contract.versions, version],
    updatedAt: new Date().toISOString(),
  };
  saveContract(updated);
  return version;
}

export function restoreVersion(
  contractId: string,
  versionId: string,
): Contract | null {
  const contract = getContract(contractId);
  if (!contract) return null;
  const version = contract.versions.find((v) => v.id === versionId);
  if (!version) return null;
  const restored: Contract = {
    ...contract,
    content: version.content,
    updatedAt: new Date().toISOString(),
  };
  saveContract(restored);
  return restored;
}

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

export function updateContractMeta(
  id: string,
  meta: Partial<
    Pick<
      Contract,
      "title" | "status" | "type" | "parties" | "tags" | "pageMargins"
    >
  >,
): void {
  const contract = getContract(id);
  if (!contract) return;
  saveContract({ ...contract, ...meta });
}

// ---------------------------------------------------------------------------
// Template storage
// ---------------------------------------------------------------------------

const TEMPLATE_KEY = "lawsky_templates";

const BUILT_IN_TEMPLATE_BODIES: Array<Omit<Template, "variables">> = [
  {
    id: "builtin-service-agreement",
    name: "Service Agreement",
    description: "Standard professional services agreement between a client and a service provider",
    category: "Business",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# SERVICE AGREEMENT\n\nThis Service Agreement is made and entered into as of {{effectiveDate as \"D MMMM YYYY\"}} by and between {{clientName}}, located at {{clientAddress}} (\"Client\"), and {{providerName}}, located at {{providerAddress}} (\"Provider\").\n\n## 1. Services\n\nProvider agrees to perform the following services: {{serviceDescription}}.\n\n## 2. Compensation\n\nClient shall pay Provider {{serviceAmount}} for the services described herein. Payment shall be made within {{paymentDays}} days of invoice receipt.\n\n## 3. Term\n\nThis Agreement shall commence on {{startDate as \"D MMMM YYYY\"}} and continue until {{endDate as \"D MMMM YYYY\"}}, unless earlier terminated by either party.\n\n## 4. Confidentiality\n\nEach party agrees to hold in strict confidence any proprietary or confidential information received from the other party.\n\n## 5. Governing Law\n\nThis Agreement shall be governed by the laws of {{governingLaw}}.",
  },
  {
    id: "builtin-nda",
    name: "Non-Disclosure Agreement",
    description: "Mutual NDA to protect confidential information shared between two parties",
    category: "Legal",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis Agreement is entered into as of {{effectiveDate as \"D MMMM YYYY\"}} between {{partyAName}}, located at {{partyAAddress}} (\"Party A\"), and {{partyBName}}, located at {{partyBAddress}} (\"Party B\").\n\n## 1. Purpose\n\nThe parties wish to explore: {{purpose}}.\n\n## 2. Confidential Information\n\nConfidential Information means any non-public information disclosed by either party to the other.\n\n## 3. Obligations\n\nEach party agrees to: (a) keep the Confidential Information strictly confidential; (b) not disclose such information to third parties without prior written consent.\n\n## 4. Term\n\nThis Agreement shall remain in effect for {{termYears}} years from the Effective Date.\n\n## 5. Governing Law\n\nThis Agreement shall be governed by the laws of {{governingLaw}}.",
  },
  {
    id: "builtin-employment",
    name: "Employment Contract",
    description: "Full-time employment agreement with compensation and role details",
    category: "HR",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# EMPLOYMENT AGREEMENT\n\nThis Employment Agreement is entered into as of {{effectiveDate as \"D MMMM YYYY\"}} between {{companyName}}, located at {{companyAddress}} (\"Employer\"), and {{employeeName}}, residing at {{employeeAddress}} (\"Employee\").\n\n## 1. Position\n\nEmployee is hired for the position of {{jobTitle}} in the {{department}} department, reporting to {{reportingTo}}.\n\n## 2. Start Date\n\nEmployee's employment shall commence on {{startDate as \"D MMMM YYYY\"}}.\n\n## 3. Compensation\n\nEmployer shall pay Employee an annual salary of {{annualSalary}}.\n\n## 4. Benefits\n\nEmployee shall be entitled to {{vacationDays}} days of paid annual leave per year.\n\n## 5. Probation Period\n\nEmployee's first {{probationMonths}} months shall constitute a probation period.\n\n## 6. Governing Law\n\nThis Agreement shall be governed by the laws of {{governingLaw}}.",
  },
  {
    id: "builtin-freelance",
    name: "Freelance Agreement",
    description: "Agreement for independent contractor / freelance project work",
    category: "Business",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# FREELANCE SERVICES AGREEMENT\n\nThis Agreement is made as of {{effectiveDate as \"D MMMM YYYY\"}} between {{clientName}}, located at {{clientAddress}} (\"Client\"), and {{freelancerName}}, located at {{freelancerAddress}} (\"Freelancer\").\n\n## 1. Scope of Work\n\nFreelancer agrees to deliver: {{projectDescription}}.\n\n## 2. Deliverables & Timeline\n\nThe project shall be completed by {{deliveryDate as \"D MMMM YYYY\"}}.\n\n## 3. Payment\n\nClient shall pay Freelancer a total fee of {{projectFee}}. A deposit of {{depositAmount}} is due upon signing.\n\n## 4. Revisions\n\nThis Agreement includes up to {{revisionRounds}} rounds of revisions. Additional revisions will be billed at {{hourlyRate}} per hour.\n\n## 5. Ownership\n\nUpon receipt of full payment, all intellectual property rights shall be transferred to Client.\n\n## 6. Independent Contractor\n\nFreelancer is an independent contractor and not an employee of Client.",
  },
  {
    id: "builtin-partnership",
    name: "Partnership Agreement",
    description: "Legal document that dictates the way a business is run and details the relationship between partners.",
    category: "Business",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# PARTNERSHIP AGREEMENT\n\nThis Partnership Agreement is made on {{effectiveDate as \"D MMMM YYYY\"}} by and between {{partnerOneName}} and {{partnerTwoName}}.\n\n## 1. Name and Business\n\nThe parties hereby form a partnership under the name of {{partnershipName}} to conduct the business of {{businessDescription}}.\n\n## 2. Term\n\nThe partnership shall begin on {{startDate as \"D MMMM YYYY\"}} and shall continue until terminated.\n\n## 3. Capital Contributions\n\n{{partnerOneName}} shall contribute {{partnerOneContribution}} and {{partnerTwoName}} shall contribute {{partnerTwoContribution}}.\n\n## 4. Profit and Loss\n\nProfits and losses shall be divided equally between the partners.\n\n## 5. Management\n\nBoth partners shall have equal rights in the management of the partnership business.",
  },
  {
    id: "builtin-terms-of-use",
    name: "Website Terms of Use",
    description: "Standard terms and conditions for users accessing a website or web application.",
    category: "Legal",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# TERMS OF USE\n\nWelcome to {{websiteName}}. By accessing this website, we assume you accept these terms and conditions.\n\n## 1. License\n\nUnless otherwise stated, {{companyName}} owns the intellectual property rights for all material on {{websiteName}}.\n\n## 2. User Content\n\nParts of this website offer an opportunity for users to post and exchange opinions and information.\n\n## 3. Hyperlinking\n\nThe following organizations may link to our Website without prior written approval: Government agencies, Search engines, News organizations.\n\n## 4. Disclaimer\n\nTo the maximum extent permitted by applicable law, we exclude all representations, warranties, and conditions relating to our website and the use of this website.",
  },
  {
    id: "builtin-commercial-lease",
    name: "Commercial Lease Agreement",
    description: "Contract for renting commercial property for business use.",
    category: "Real Estate",
    builtIn: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    body: "# COMMERCIAL LEASE AGREEMENT\n\nThis Lease Agreement is made on {{effectiveDate as \"D MMMM YYYY\"}}, between {{landlordName}} (\"Landlord\") and {{tenantName}} (\"Tenant\").\n\n## 1. Premises\n\nThe Landlord agrees to lease to the Tenant the property located at {{propertyAddress}}.\n\n## 2. Term\n\nThe lease term shall commence on {{leaseStartDate}} and terminate on {{leaseEndDate}}.\n\n## 3. Rent\n\nThe Tenant shall pay a monthly rent of {{monthlyRent}} on the 1st day of each month.\n\n## 4. Use of Premises\n\nThe Premises shall be used exclusively for {{permittedUse}}.\n\n## 5. Maintenance\n\nThe Tenant shall keep the Premises in good repair and condition.",
  },
];

function readAllTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? (JSON.parse(raw) as Template[]) : [];
  } catch {
    return [];
  }
}

function writeAllTemplates(templates: Template[]): void {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function seedBuiltInTemplates(): void {
  if (typeof window === "undefined") return;
  const existing = readAllTemplates();
  const existingIds = new Set(existing.map((t) => t.id));
  const toAdd: Template[] = BUILT_IN_TEMPLATE_BODIES.filter(
    (t) => !existingIds.has(t.id),
  ).map((t) => ({ ...t, variables: buildVariables(t.body, []) }));
  if (toAdd.length > 0) {
    writeAllTemplates([...existing, ...toAdd]);
  }
}

export function getTemplates(): Template[] {
  seedBuiltInTemplates();
  return readAllTemplates();
}

export function getTemplate(id: string): Template | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function saveTemplate(template: Template): void {
  const all = readAllTemplates();
  const idx = all.findIndex((t) => t.id === template.id);
  const updated = { ...template, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.unshift(updated);
  }
  writeAllTemplates(all);
}

export function deleteTemplate(id: string): void {
  writeAllTemplates(readAllTemplates().filter((t) => t.id !== id));
}

export function createNewTemplate(name = "Untitled Template"): Template {
  const now = new Date().toISOString();
  const body = "# " + name + "\n\nThis agreement is made as of {{effectiveDate as \"D MMMM YYYY\"}} between {{partyAName}}, located at {{partyAAddress}}, and {{partyBName}}, located at {{partyBAddress}}.\n\n## 1. Terms\n\nDescribe the terms here.";
  return {
    id: crypto.randomUUID(),
    name,
    description: "",
    category: "Business",
    body,
    variables: buildVariables(body, []),
    createdAt: now,
    updatedAt: now,
  };
}
