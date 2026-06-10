"use client";

/**
 * version-history.tsx
 * Standalone version history page — accessible from the sidebar nav "Version History".
 * Shows version history for the most recently edited contract.
 */

import { useState, useEffect } from "react";
import { ArrowLeft, Clock, FileText, RotateCcw, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllContracts, restoreVersion } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import {
  STATUS_STYLES,
  type Contract,
  type ContractVersion,
} from "@/types/contract";

interface VersionHistoryProps {
  contractId?: string | null;
  onOpenContract?: (id: string) => void;
  setCurrentView?: (view: string) => void;
}

export default function VersionHistory({
  contractId,
  onOpenContract,
  setCurrentView,
}: VersionHistoryProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    contractId ?? null,
  );
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    const all = getAllContracts();
    setContracts(all);
    if (!selectedId && all.length > 0) {
      setSelectedId(all[0].id);
    }
  }, []);

  const selected = contracts.find((c) => c.id === selectedId);
  const versions = selected ? [...selected.versions].reverse() : [];

  const handleRestore = async (version: ContractVersion) => {
    if (!selected) return;
    setRestoring(version.id);
    const restored = restoreVersion(selected.id, version.id);
    if (restored) {
      setContracts((prev) =>
        prev.map((c) => (c.id === selected.id ? restored : c)),
      );
    }
    setRestoring(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {setCurrentView && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView("dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Version History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and restore previous versions of your contracts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Contract selector */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Contracts
              </h3>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {contracts.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No contracts found
                  </p>
                </div>
              ) : (
                contracts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 ${
                      selectedId === c.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{c.title}</span>
                    {c.versions.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {c.versions.length}v
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Version list */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Select a contract to view its version history
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Contract header */}
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selected.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.type} · Updated {formatDate(selected.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLES[selected.status]}`}
                  >
                    {selected.status}
                  </span>
                  {onOpenContract && (
                    <Button
                      size="sm"
                      onClick={() => onOpenContract(selected.id)}
                    >
                      Open Editor
                    </Button>
                  )}
                </div>
              </div>

              {/* Versions */}
              {versions.length === 0 ? (
                <div className="p-10 text-center">
                  <Hash className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No saved versions yet. Use &quot;Save Version&quot; in the
                    editor to create checkpoints.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {versions.map((version, idx) => (
                    <div
                      key={version.id}
                      className="p-5 flex items-start gap-4"
                    >
                      {/* Version number badge */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        v{version.number}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">
                            {version.label}
                          </p>
                          {idx === 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(version.createdAt)}
                          </span>
                          <span>
                            {version.wordCount.toLocaleString()} words
                          </span>
                          <span>
                            {version.charCount.toLocaleString()} chars
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version)}
                        disabled={restoring === version.id}
                        className="shrink-0 gap-1.5"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${restoring === version.id ? "animate-spin" : ""}`}
                        />
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
