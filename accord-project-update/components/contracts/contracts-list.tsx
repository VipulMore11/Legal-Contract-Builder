"use client";

/**
 * contracts-list.tsx
 * Compact "recent contracts" widget for the Dashboard.
 * Full management is in contract-picker.tsx.
 */

import { useState, useEffect } from "react";
import { FileText, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAllContracts,
  createNewContract,
  saveContract,
} from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { STATUS_STYLES, type Contract } from "@/types/contract";

interface ContractsListProps {
  onOpenContract: (id: string) => void;
}

export default function ContractsList({ onOpenContract }: ContractsListProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    setContracts(getAllContracts().slice(0, 6)); // show 6 most recent
  }, []);

  const handleNew = () => {
    const c = createNewContract();
    saveContract(c);
    onOpenContract(c.id);
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Recent Contracts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your most recently updated contracts
          </p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No contracts yet</p>
          <Button onClick={handleNew} variant="outline" size="sm">
            Create your first contract
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {contracts.map((contract) => (
            <button
              key={contract.id}
              onClick={() => onOpenContract(contract.id)}
              className="w-full text-left p-4 hover:bg-secondary/40 transition-colors flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-foreground text-sm truncate">
                    {contract.title}
                  </p>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[contract.status]}`}
                  >
                    {contract.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(contract.updatedAt)} · {contract.type}
                </p>
              </div>
              {contract.versions.length > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  v{contract.versions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
