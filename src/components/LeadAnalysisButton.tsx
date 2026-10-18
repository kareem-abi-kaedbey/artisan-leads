"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LeadAnalysisButton({ leadId, hasAnalysis }: { leadId: string; hasAnalysis: boolean }) {
  const router = useRouter();
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const busy = saving || refreshing;

  async function generate() {
    if (locked.current || busy) return;
    locked.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/analyze`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.message === "string" ? body.message : "Impossible de générer l’analyse. Veuillez réessayer.");
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de générer l’analyse. Veuillez réessayer.");
    } finally {
      setSaving(false);
      locked.current = false;
    }
  }

  return (
    <div className="mt-5" aria-busy={busy}>
      <button type="button" onClick={generate} disabled={busy} className="button button-dark disabled:cursor-wait disabled:opacity-60">
        {busy ? "Analyse en cours..." : hasAnalysis ? "Régénérer l’analyse" : "Analyser avec l’IA"}
      </button>
      <p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-red-700">{error}</p>
    </div>
  );
}
