"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/ProjectContext";

interface SearchResults {
  boqItems: { id: string; itemNumber: string; description: string }[];
  costCodes: { id: string; code: string; description: string }[];
  wbs: { id: string; code: string; name: string }[];
  materials: { id: string; code: string; description: string }[];
  subcontractors: { id: string; companyName: string; scope: string | null }[];
  actualCosts: { id: string; description: string; supplier: string | null; netAmount: string }[];
}

export function GlobalSearch() {
  const { currentProject } = useProject();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data } = useQuery({
    queryKey: ["global-search", currentProject?.id, debounced],
    queryFn: async () => (await api.get<SearchResults>(`/projects/${currentProject!.id}/search`, { params: { q: debounced } })).data,
    enabled: !!currentProject && debounced.trim().length >= 2,
  });

  const hasResults =
    data &&
    (data.boqItems.length || data.costCodes.length || data.wbs.length || data.materials.length || data.subcontractors.length || data.actualCosts.length);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5">
        <Search size={14} className="text-slate-500" />
        <input
          className="w-56 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
          placeholder="Search BOQ, cost codes, materials..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && debounced.trim().length >= 2 && (
        <div className="absolute left-0 z-50 mt-1 w-96 max-h-96 overflow-y-auto rounded-md border border-slate-800 bg-slate-900 shadow-xl">
          {!hasResults ? (
            <p className="p-3 text-sm text-slate-500">No matches.</p>
          ) : (
            <>
              <ResultGroup title="BOQ Items">
                {data!.boqItems.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/boq")}>
                    <span className="font-mono text-amber-400">{r.itemNumber}</span> — {r.description}
                  </ResultRow>
                ))}
              </ResultGroup>
              <ResultGroup title="Cost Codes">
                {data!.costCodes.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/cost-codes")}>
                    <span className="font-mono text-amber-400">{r.code}</span> — {r.description}
                  </ResultRow>
                ))}
              </ResultGroup>
              <ResultGroup title="WBS">
                {data!.wbs.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/wbs")}>
                    <span className="font-mono text-amber-400">{r.code}</span> — {r.name}
                  </ResultRow>
                ))}
              </ResultGroup>
              <ResultGroup title="Materials">
                {data!.materials.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/materials")}>
                    <span className="font-mono text-amber-400">{r.code}</span> — {r.description}
                  </ResultRow>
                ))}
              </ResultGroup>
              <ResultGroup title="Subcontractors">
                {data!.subcontractors.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/subcontractors")}>
                    {r.companyName} {r.scope ? `— ${r.scope}` : ""}
                  </ResultRow>
                ))}
              </ResultGroup>
              <ResultGroup title="Actual Cost Transactions">
                {data!.actualCosts.map((r) => (
                  <ResultRow key={r.id} onClick={() => go("/actual-cost")}>
                    {r.description} {r.supplier ? `(${r.supplier})` : ""}
                  </ResultRow>
                ))}
              </ResultGroup>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  if (items.length === 0) return null;
  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function ResultRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800/60">
      {children}
    </button>
  );
}
