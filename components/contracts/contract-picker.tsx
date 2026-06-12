"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Plus,
  Copy,
  Trash2,
  SortAsc,
  Clock,
  Users,
  Tag,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAllContracts,
  deleteContract,
  duplicateContract,
  createNewContract,
  saveContract,
} from "@/lib/storage";
import {
  type Contract,
  type ContractStatus,
  type ContractType,
  CONTRACT_TYPES,
  STATUS_STYLES,
} from "@/types/contract";
import { formatDate, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractPickerProps {
  onOpenContract: (id: string) => void;
}

type SortField = "updatedAt" | "createdAt" | "title";
type StatusFilter = ContractStatus | "All";
type TypeFilter = ContractType | "All";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: ContractStatus[] = ["Draft", "Review", "Signed", "Archived"];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Date Created" },
  { value: "title", label: "Title (A–Z)" },
];

// Short labels for the type filter dropdown
const TYPE_SHORT: Record<ContractType, string> = {
  "Service Agreement": "Service",
  "Non-Disclosure Agreement": "NDA",
  "Employment Contract": "Employment",
  "Freelance Agreement": "Freelance",
  "License Agreement": "License",
  "Purchase Agreement": "Purchase",
  "Partnership Agreement": "Partnership",
  "Lease Agreement": "Lease",
  "Consulting Agreement": "Consulting",
  Other: "Other",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContractPicker({
  onOpenContract,
}: ContractPickerProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [sortBy, setSortBy] = useState<SortField>("updatedAt");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const refresh = () => setContracts(getAllContracts());

  useEffect(() => {
    refresh();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<ContractStatus, number> = {
      Draft: 0,
      Review: 0,
      Signed: 0,
      Archived: 0,
    };
    contracts.forEach((c) => counts[c.status]++);
    return counts;
  }, [contracts]);

  const filtered = useMemo(() => {
    let list = [...contracts];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "All") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (typeFilter !== "All") {
      list = list.filter((c) => c.type === typeFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
    });

    return list;
  }, [contracts, search, statusFilter, typeFilter, sortBy]);

  const hasActiveFilters =
    search.trim() || statusFilter !== "All" || typeFilter !== "All";

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNewContract = () => {
    const c = createNewContract();
    saveContract(c);
    onOpenContract(c.id);
  };

  const handleDuplicate = (id: string) => {
    duplicateContract(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteContract(id);
    setDeleteConfirmId(null);
    refresh();
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setTypeFilter("All");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-auto">
      <div className="max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Contracts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {contracts.length} contract{contracts.length !== 1 ? "s" : ""} in
              your workspace
            </p>
          </div>
          <Button
            onClick={handleNewContract}
            className="shrink-0 gap-2"
            size="lg"
          >
            <Plus className="size-4" />
            New Contract
          </Button>
        </div>

        {/* ── Statistics pills ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("All")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === "All"
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
            )}
          >
            All ({contracts.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                statusFilter === s
                  ? STATUS_STYLES[s]
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              {s} ({statusCounts[s]})
            </button>
          ))}
        </div>

        {/* ── Filters bar ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contracts…"
              className={cn(
                "w-full h-9 bg-card border border-border rounded-lg pl-9 pr-9 text-sm",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
                "transition-colors",
              )}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={cn(
                "h-9 bg-card border border-border rounded-lg px-3 pr-8 text-sm appearance-none cursor-pointer",
                "text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
                "transition-colors",
                statusFilter !== "All" && "border-primary/50 text-primary",
              )}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className={cn(
                "h-9 bg-card border border-border rounded-lg px-3 pr-8 text-sm appearance-none cursor-pointer",
                "text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
                "transition-colors",
                typeFilter !== "All" && "border-primary/50 text-primary",
              )}
            >
              <option value="All">All Types</option>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className={cn(
                "h-9 bg-card border border-border rounded-lg px-3 pr-8 text-sm appearance-none cursor-pointer",
                "text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
                "transition-colors",
              )}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <SortAsc className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* ── Grid or empty state ── */}
        {filtered.length === 0 ? (
          <EmptyState
            hasContracts={contracts.length > 0}
            hasFilters={!!hasActiveFilters}
            onNew={handleNewContract}
            onClear={clearFilters}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                isConfirmingDelete={deleteConfirmId === contract.id}
                onOpen={() => onOpenContract(contract.id)}
                onDuplicate={() => handleDuplicate(contract.id)}
                onDeleteRequest={() => setDeleteConfirmId(contract.id)}
                onDeleteConfirm={() => handleDelete(contract.id)}
                onDeleteCancel={() => setDeleteConfirmId(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract card
// ---------------------------------------------------------------------------

interface ContractCardProps {
  contract: Contract;
  isConfirmingDelete: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function ContractCard({
  contract,
  isConfirmingDelete,
  onOpen,
  onDuplicate,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: ContractCardProps) {
  const partyNames =
    contract.parties.length > 0
      ? contract.parties
          .slice(0, 2)
          .map((p) => p.name)
          .join(", ") +
        (contract.parties.length > 2 ? ` +${contract.parties.length - 2}` : "")
      : null;

  return (
    <div
      className={cn(
        "group flex flex-col bg-card border border-border rounded-xl p-5 gap-4",
        "transition-all duration-200",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5",
        isConfirmingDelete &&
          "border-destructive/50 shadow-lg shadow-destructive/10",
      )}
    >
      {/* Top row: type pill + status badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/60 text-secondary-foreground text-xs font-medium border border-border">
          <Tag className="size-3 shrink-0" />
          {TYPE_SHORT[contract.type]}
        </span>
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
            STATUS_STYLES[contract.status],
          )}
        >
          {contract.status}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-h-0 space-y-2">
        <h3
          className="font-semibold text-foreground leading-snug line-clamp-1 cursor-pointer hover:text-primary transition-colors"
          onClick={onOpen}
          title={contract.title}
        >
          {contract.title}
        </h3>

        {/* Parties */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 shrink-0" />
          {partyNames ? (
            <span className="truncate">{partyNames}</span>
          ) : (
            <span className="italic">No parties defined</span>
          )}
        </div>

        {/* Dates row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>Updated {formatDate(contract.updatedAt)}</span>
        </div>
      </div>

      {/* Meta chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {contract.versions.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/40 text-muted-foreground text-xs border border-border">
            <Clock className="size-3" />
            {contract.versions.length} version
            {contract.versions.length !== 1 ? "s" : ""}
          </span>
        )}
        {contract.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs border border-accent/20"
          >
            {tag}
          </span>
        ))}
        {contract.tags.length > 2 && (
          <span className="text-xs text-muted-foreground">
            +{contract.tags.length - 2}
          </span>
        )}
      </div>

      {/* Actions row */}
      {isConfirmingDelete ? (
        <DeleteConfirm onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} />
      ) : (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button
            variant="default"
            size="sm"
            onClick={onOpen}
            className="flex-1 gap-1.5"
          >
            <FileText className="size-3.5" />
            Open Editor
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onDuplicate}
            title="Duplicate contract"
            className="shrink-0"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDeleteRequest}
            title="Delete contract"
            className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline delete confirmation
// ---------------------------------------------------------------------------

function DeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-destructive/30">
      <div className="flex items-center gap-2 text-xs text-destructive font-medium">
        <AlertTriangle className="size-3.5 shrink-0" />
        Delete this contract permanently?
      </div>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onConfirm}
          className="flex-1 gap-1.5"
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  hasContracts,
  hasFilters,
  onNew,
  onClear,
}: {
  hasContracts: boolean;
  hasFilters: boolean;
  onNew: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="size-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-5 shadow-inner">
        <FileText className="size-8 text-muted-foreground" />
      </div>
      {hasContracts && hasFilters ? (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No contracts match your filters
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Try adjusting your search or filter criteria to find what
            you&apos;re looking for.
          </p>
          <Button variant="outline" onClick={onClear} className="gap-2">
            <X className="size-4" />
            Clear Filters
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No contracts yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Create your first contract to get started. You can draft, review,
            sign, and manage all your agreements in one place.
          </p>
          <Button onClick={onNew} className="gap-2">
            <Plus className="size-4" />
            Create First Contract
          </Button>
        </>
      )}
    </div>
  );
}
