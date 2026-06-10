import {
  LayoutDashboard,
  FileText,
  Library,
  Brain,
  GitBranch,
  History,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentView: string;
  setCurrentView: (view: any) => void;
  noPadding?: boolean;
}

export default function DashboardLayout({
  children,
  currentView,
  setCurrentView,
  noPadding = false,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "editor", label: "Contract Editor", icon: FileText }, // routes to picker
    { id: "templates", label: "Templates", icon: Library },
    { id: "clauses", label: "Clause Library", icon: Brain },
    { id: "data-model", label: "Data Model", icon: GitBranch },
    { id: "history", label: "Version History", icon: History },
  ];

  return (
    <div className="layout-shell flex h-screen bg-background">
      {/* Sidebar — hidden when printing so only the document canvas appears */}
      <aside
        className={`no-print ${sidebarOpen ? "w-64" : "w-20"} bg-card border-r border-border transition-all duration-200 flex flex-col`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1
            className={`font-bold text-xl text-primary ${!sidebarOpen && "hidden"}`}
          >
            lawsky
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  currentView === item.id ||
                  (item.id === "editor" && currentView === "picker")
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div
            className={`text-xs text-muted-foreground ${!sidebarOpen && "text-center"}`}
          >
            {sidebarOpen ? "v1.0.0" : "v1"}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div
          className={noPadding ? "flex-1 flex flex-col overflow-hidden" : "p-8"}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
